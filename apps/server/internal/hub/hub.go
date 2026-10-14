// Package hub reenvía el estado de cada pato a los demás clientes conectados.
package hub

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"math/rand/v2"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/omaradriano/sayitwithquack/server/internal/pet"
	"github.com/omaradriano/sayitwithquack/server/internal/protocol"
	"github.com/omaradriano/sayitwithquack/server/internal/push"
	"github.com/omaradriano/sayitwithquack/server/internal/store"
)

const (
	maxMessage    = 60               // caracteres del mensaje personalizado
	quackCooldown = 10 * time.Second // mínimo entre quacks del mismo pato
	// Subject VAPID: Apple exige un https:// o mailto: para contactar al dueño del servidor.
	pushSubject = "https://sayitwithquack.vercel.app"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

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

	store *store.Store

	mu      sync.Mutex
	clients map[string]*client // un cliente por pato
	// data: configuración, última conexión, última posición, suscripciones push y llaves VAPID.
	// Se guarda en disco al cambiar la configuración, al suscribirse o cuando alguien se va.
	data      *store.Data
	lastQuack map[string]time.Time
}

func New(ducks, origins []string, st *store.Store) (*Hub, error) {
	data, err := st.Load()
	if err != nil {
		return nil, err
	}
	// La primera vez generamos las llaves VAPID y las guardamos: así las suscripciones
	// siguen siendo válidas entre despliegues.
	if data.Vapid == nil {
		keys, err := push.GenerateKeys()
		if err != nil {
			return nil, err
		}
		data.Vapid = &keys
		if err := st.Save(data); err != nil {
			return nil, err
		}
		log.Printf("llaves VAPID generadas")
	}
	// Cada pato empieza lleno.
	for _, duck := range ducks {
		if _, ok := data.Pets[duck]; !ok {
			data.Pets[duck] = pet.New(time.Now())
		}
	}
	return &Hub{
		ducks:     ducks,
		origins:   origins,
		store:     st,
		clients:   map[string]*client{},
		data:      data,
		lastQuack: map[string]time.Time{},
	}, nil
}

// ServeHTTP acepta la conexión websocket y la atiende hasta que se cierra.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.origins})
	if err != nil {
		log.Printf("ws accept: %v", err)
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(4096) // las suscripciones push traen una URL larga
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
		case "config":
			var cfg protocol.Config
			if json.Unmarshal(data, &cfg) != nil {
				continue
			}
			h.updateConfig(c, cfg)
		case "push-subscribe":
			var msg protocol.PushSubscribe
			var sub webpush.Subscription
			if json.Unmarshal(data, &msg) != nil || json.Unmarshal(msg.Subscription, &sub) != nil {
				continue
			}
			h.subscribe(c, sub)
		case "quack":
			h.quack(c)
		case "feed":
			h.feed(c)
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
	h.queue(c, protocol.Welcome{
		T:        "welcome",
		Online:   h.onlineLocked(),
		LastSeen: h.data.LastSeen,
		States:   h.data.States,
		Configs:  h.data.Configs,
		VapidKey: h.data.Vapid.Public,
		Pets:     h.petsLocked(),
		Now:      time.Now().UnixMilli(),
		Days:     h.data.Together.Days,
	})
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
	h.data.LastSeen[c.duck] = time.Now().UnixMilli()
	h.saveLocked()
	log.Printf("%s salió", c.duck)
	h.broadcastLocked(h.presenceLocked(), nil)
}

func (h *Hub) updateState(c *client, s protocol.State) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return
	}
	h.data.States[c.duck] = s // en memoria; se guarda en disco al salir
	h.broadcastLocked(s, c)
}

func (h *Hub) updateConfig(c *client, cfg protocol.Config) {
	// Validamos: colores #rrggbb y mensaje corto.
	if !hexColor.MatchString(cfg.Body) || !hexColor.MatchString(cfg.Wing) || !hexColor.MatchString(cfg.Head) {
		return
	}
	cfg.T = "config"
	cfg.Duck = c.duck
	cfg.Message = strings.TrimSpace(cfg.Message)
	if utf8.RuneCountInString(cfg.Message) > maxMessage {
		cfg.Message = string([]rune(cfg.Message)[:maxMessage])
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return
	}
	previous := h.data.Configs[c.duck].Message
	h.data.Configs[c.duck] = cfg
	h.saveLocked()
	log.Printf("%s guardó su configuración", c.duck)
	h.broadcastLocked(cfg, c)

	// Mensaje nuevo → notificación a la pareja.
	if cfg.Message != "" && cfg.Message != previous {
		h.notifyOthersLocked(c.duck, push.Payload{
			Title: displayName(c.duck) + " te dejó un mensaje 💬",
			Body:  cfg.Message,
			Tag:   "message-" + c.duck,
		}, push.Options{TTL: 24 * 60 * 60})
	}
}

// feed alimenta al pato de quien lo pide (cada quien solo al suyo).
func (h *Hub) feed(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return
	}
	now := time.Now()
	fed, reason := h.data.Pets[c.duck].Feed(now)
	if reason != "" {
		h.queue(c, protocol.FeedResult{T: "feed-result", Reason: reason})
		return
	}
	h.data.Pets[c.duck] = fed
	h.data.HungryNotified[c.duck] = false
	before := h.data.Together.Days
	h.data.Together = h.data.Together.Update(h.data.Pets, h.ducks, now)
	if h.data.Together.Days > before {
		log.Printf("los dos alimentaron hoy: %d días", h.data.Together.Days)
	}
	h.saveLocked()
	log.Printf("%s alimentó a su pato (%.0f%%)", c.duck, fed.Level)
	// A todos, incluido quien alimentó: así la animación sale igual en ambos teléfonos.
	msg := protocol.Pet{
		T: "pet", Duck: c.duck, PetState: protocol.PetState(fed),
		Fed: true, Seed: rand.IntN(1 << 30), Now: now.UnixMilli(), Days: h.data.Together.Days,
	}
	h.broadcastLocked(msg, nil)
}

func (h *Hub) petsLocked() map[string]protocol.PetState {
	pets := map[string]protocol.PetState{}
	for duck, s := range h.data.Pets {
		pets[duck] = protocol.PetState(s)
	}
	return pets
}

// WatchHunger revisa cada pocos minutos si algún pato tiene hambre y le avisa a su dueño.
func (h *Hub) WatchHunger(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		h.checkHunger()
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func (h *Hub) checkHunger() {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	for duck, s := range h.data.Pets {
		if s.Current(now) >= pet.HungryAt || h.data.HungryNotified[duck] {
			continue
		}
		h.data.HungryNotified[duck] = true
		h.saveLocked()
		sent := h.notifyLocked(func(d string) bool { return d == duck }, push.Payload{
			Title: "Tu patito tiene hambre 🥺",
			Body:  "Dale de comer antes de que se quede dormido 🍞",
			Tag:   "hungry-" + duck,
		}, push.Options{TTL: 12 * 60 * 60})
		log.Printf("%s tiene hambre (aviso a %d dispositivos)", duck, sent)
	}
}

// subscribe guarda la suscripción push de este dispositivo.
func (h *Hub) subscribe(c *client, sub webpush.Subscription) {
	if !strings.HasPrefix(sub.Endpoint, "https://") || sub.Keys.Auth == "" || sub.Keys.P256dh == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	// Un dispositivo pertenece a un solo pato: si estaba registrado con otro (#salir), se mueve.
	h.removeEndpointLocked(sub.Endpoint)
	h.data.Subscriptions[c.duck] = append(h.data.Subscriptions[c.duck], sub)
	h.saveLocked()
	log.Printf("%s activó notificaciones (%d dispositivos)", c.duck, len(h.data.Subscriptions[c.duck]))
}

// quack manda una notificación "¡Quack!" a la pareja.
func (h *Hub) quack(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.duck] != c {
		return
	}
	if time.Since(h.lastQuack[c.duck]) < quackCooldown {
		h.queue(c, protocol.QuackResult{T: "quack-result", Reason: "cooldown"})
		return
	}
	h.lastQuack[c.duck] = time.Now()
	sent := h.notifyOthersLocked(c.duck, push.Payload{
		Title: "¡Quack! 💛",
		Body:  displayName(c.duck) + " te mandó un quack 🦆",
		Tag:   "quack-" + c.duck,
	}, push.Options{TTL: 60 * 60, Urgent: true})
	result := protocol.QuackResult{T: "quack-result", Sent: sent}
	if sent == 0 {
		result.Reason = "no-subscription"
	}
	h.queue(c, result)
}

// notifyOthersLocked envía un push a todos los dispositivos de los demás patos
// y devuelve a cuántos. El envío ocurre en segundo plano. Requiere h.mu.
func (h *Hub) notifyOthersLocked(from string, p push.Payload, o push.Options) int {
	return h.notifyLocked(func(duck string) bool { return duck != from }, p, o)
}

// notifyLocked envía un push a los dispositivos de los patos que cumplan to(duck).
// Devuelve a cuántos; el envío ocurre en segundo plano. Requiere h.mu.
func (h *Hub) notifyLocked(to func(duck string) bool, p push.Payload, o push.Options) int {
	o.Subject = pushSubject
	keys := *h.data.Vapid
	var subs []webpush.Subscription
	for duck, list := range h.data.Subscriptions {
		if to(duck) {
			subs = append(subs, list...)
		}
	}
	for _, sub := range subs {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			gone, err := push.Send(ctx, keys, sub, p, o)
			if err != nil {
				log.Printf("push: %v", err)
			}
			if gone {
				h.mu.Lock()
				h.removeEndpointLocked(sub.Endpoint)
				h.saveLocked()
				h.mu.Unlock()
				log.Printf("push: suscripción vencida eliminada")
			}
		}()
	}
	return len(subs)
}

func (h *Hub) removeEndpointLocked(endpoint string) {
	for duck, list := range h.data.Subscriptions {
		h.data.Subscriptions[duck] = slices.DeleteFunc(list, func(s webpush.Subscription) bool {
			return s.Endpoint == endpoint
		})
	}
}

// displayName: "omar" → "Omar".
func displayName(id string) string {
	if id == "" {
		return id
	}
	r, size := utf8.DecodeRuneInString(id)
	return strings.ToUpper(string(r)) + id[size:]
}

// saveLocked escribe el estado a disco. Requiere h.mu.
func (h *Hub) saveLocked() {
	if err := h.store.Save(h.data); err != nil {
		log.Printf("no se pudo guardar el estado: %v", err)
	}
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
	return protocol.Presence{T: "presence", Online: h.onlineLocked(), LastSeen: h.data.LastSeen}
}

func (h *Hub) onlineLocked() []string {
	online := make([]string, 0, len(h.clients))
	for duck := range h.clients {
		online = append(online, duck)
	}
	slices.Sort(online)
	return online
}
