// Package hub reenvía el estado de cada pato a los demás clientes conectados.
package hub

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/omaradriano/sayitwithquack/server/internal/protocol"
)

// client es una conexión websocket abierta de un pato.
type client struct {
	duck string
	conn *websocket.Conn
	// send es una cola de salida; una goroutine la escribe al socket.
	send chan []byte
}

type Hub struct {
	ducks   []string // ids válidos
	origins []string // patrones de Origin permitidos

	mu      sync.Mutex
	clients map[string]*client        // un cliente por pato
	last    map[string]protocol.State // última posición conocida de cada pato
	// lastSeen guarda cuándo se desconectó cada pato (ms Unix). Vive en memoria:
	// se pierde si el servidor se reinicia o se vuelve a desplegar.
	lastSeen map[string]int64
}

func New(ducks, origins []string) *Hub {
	return &Hub{
		ducks:    ducks,
		origins:  origins,
		clients:  map[string]*client{},
		last:     map[string]protocol.State{},
		lastSeen: map[string]int64{},
	}
}

// ServeHTTP acepta la conexión websocket y la atiende hasta que se cierra.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.origins})
	if err != nil {
		log.Printf("ws accept: %v", err)
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(1024)
	ctx := r.Context()

	// 1) El primer mensaje debe ser "hello" con un pato válido.
	helloCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	var hello protocol.Hello
	err = wsjson.Read(helloCtx, conn, &hello)
	cancel()
	if err != nil || hello.T != "hello" || !slices.Contains(h.ducks, hello.Duck) {
		conn.Close(websocket.StatusPolicyViolation, "hello inválido")
		return
	}

	c := &client{duck: hello.Duck, conn: conn, send: make(chan []byte, 32)}
	h.join(c)
	defer h.leave(c)

	// 2) Goroutine de escritura: vacía la cola hacia el socket.
	go func() {
		for msg := range c.send {
			wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := conn.Write(wctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				conn.CloseNow()
				return
			}
		}
		// La cola se cerró: nos reemplazó otra conexión del mismo pato.
		conn.Close(websocket.StatusNormalClosure, "replaced")
	}()

	// 3) Bucle de lectura.
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) == -1 && !errors.Is(err, context.Canceled) {
				log.Printf("ws read (%s): %v", c.duck, err)
			}
			return
		}
		var env protocol.Envelope
		if json.Unmarshal(data, &env) != nil {
			continue
		}
		switch env.T {
		case "state":
			var s protocol.State
			if json.Unmarshal(data, &s) != nil {
				continue
			}
			s.Duck = c.duck // nunca confiamos en el duck que diga el mensaje
			h.updateState(c, s)
		}
	}
}

func (h *Hub) join(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Si el mismo pato ya estaba conectado (otro teléfono/pestaña), gana el nuevo.
	if old, ok := h.clients[c.duck]; ok {
		close(old.send)
	}
	h.clients[c.duck] = c
	log.Printf("%s entró", c.duck)

	// Incluye también tu propio último estado: si recargas, tu pato sigue donde estaba.
	states := map[string]protocol.State{}
	for duck, s := range h.last {
		states[duck] = s
	}
	h.queue(c, protocol.Welcome{T: "welcome", Online: h.onlineLocked(), LastSeen: h.lastSeen, States: states})
	h.broadcastLocked(h.presenceLocked(), c)
}

func (h *Hub) leave(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return // ya lo había reemplazado otra conexión
	}
	delete(h.clients, c.duck)
	close(c.send)
	h.lastSeen[c.duck] = time.Now().UnixMilli()
	log.Printf("%s salió", c.duck)
	h.broadcastLocked(h.presenceLocked(), nil)
}

func (h *Hub) updateState(c *client, s protocol.State) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return
	}
	h.last[c.duck] = s
	h.broadcastLocked(s, c)
}

// broadcastLocked manda msg a todos menos a except. Requiere h.mu.
func (h *Hub) broadcastLocked(msg any, except *client) {
	for _, other := range h.clients {
		if other != except {
			h.queue(other, msg)
		}
	}
}

// queue encola sin bloquear: si un cliente va lento, se pierde ese mensaje
// (no importa: en 100 ms llega una posición más nueva).
func (h *Hub) queue(c *client, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

func (h *Hub) presenceLocked() protocol.Presence {
	return protocol.Presence{T: "presence", Online: h.onlineLocked(), LastSeen: h.lastSeen}
}

func (h *Hub) onlineLocked() []string {
	online := make([]string, 0, len(h.clients))
	for duck := range h.clients {
		online = append(online, duck)
	}
	slices.Sort(online)
	return online
}
