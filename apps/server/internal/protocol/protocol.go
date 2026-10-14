// Package protocol define los mensajes JSON que viajan por el websocket.
// Espejo de apps/web/src/net/protocol.ts: si cambias uno, cambia el otro.
package protocol

import "encoding/json"

// Envelope sirve para leer solo el tipo antes de decodificar el resto.
type Envelope struct {
	T string `json:"t"`
}

// Hello es el primer mensaje del cliente: dice qué pato es.
type Hello struct {
	T    string `json:"t"` // "hello"
	Duck string `json:"duck"`
}

// State es la posición de un pato. El cliente lo manda sin Duck;
// el servidor le pone el Duck de quien lo envió antes de reenviarlo.
type State struct {
	T    string  `json:"t"` // "state"
	Duck string  `json:"duck,omitempty"`
	X    float64 `json:"x"`
	Z    float64 `json:"z"`
	H    float64 `json:"h"` // rumbo en radianes
	S    float64 `json:"s"` // velocidad
	M    bool    `json:"m"` // true = lo están moviendo a mano
}

// Config es la personalización de un pato (colores y mensaje).
// El cliente la manda sin Duck; el servidor le pone el Duck de quien la envió.
type Config struct {
	T       string `json:"t,omitempty"` // "config"
	Duck    string `json:"duck,omitempty"`
	Body    string `json:"body"`
	Wing    string `json:"wing"`
	Head    string `json:"head"`
	Message string `json:"message"`
}

// Welcome confirma la conexión e incluye quién está y dónde está cada pato.
type Welcome struct {
	T        string            `json:"t"` // "welcome"
	Online   []string          `json:"online"`
	LastSeen map[string]int64  `json:"lastSeen"` // ms Unix de la última desconexión
	States   map[string]State  `json:"states"`
	Configs  map[string]Config `json:"configs"`
	// Llave pública VAPID para que el navegador pueda suscribirse a notificaciones.
	VapidKey string `json:"vapidKey"`
	// Hambre de cada pato y hora del servidor (para que el cliente calcule el hambre actual).
	Pets map[string]PetState `json:"pets"`
	Now  int64               `json:"now"`
	// Contador de días compartido (sube cuando los dos alimentaron ese día).
	Days int `json:"days"`
}

// PetState: hambre "nivel en el momento at". Igual que pet.State.
type PetState struct {
	Level   float64 `json:"level"`
	At      int64   `json:"at"`
	Coins   int     `json:"coins"`
	LastDay string  `json:"lastDay"`
}

// Pet avisa que cambió el hambre de un pato. Fed = true: acaban de alimentarlo (animación).
type Pet struct {
	T    string `json:"t"` // "pet"
	Duck string `json:"duck"`
	PetState
	Fed  bool  `json:"fed"`
	Seed int   `json:"seed"` // para que las migajas caigan igual en ambos teléfonos
	Now  int64 `json:"now"`
	Days int   `json:"days"` // contador de días compartido
}

// FeedResult explica por qué no se pudo alimentar.
type FeedResult struct {
	T      string `json:"t"`      // "feed-result"
	Reason string `json:"reason"` // "full" | "coins"
}

// PushSubscribe registra este dispositivo para recibir notificaciones.
// Subscription es el PushSubscription.toJSON() del navegador.
type PushSubscribe struct {
	T            string          `json:"t"` // "push-subscribe"
	Subscription json.RawMessage `json:"subscription"`
}

// QuackResult le dice a quien mandó el quack si llegó a algún dispositivo.
type QuackResult struct {
	T      string `json:"t"`                // "quack-result"
	Sent   int    `json:"sent"`             // dispositivos a los que se envió
	Reason string `json:"reason,omitempty"` // "cooldown" | "no-subscription"
}

// Presence avisa cuando alguien entra o sale.
type Presence struct {
	T        string           `json:"t"` // "presence"
	Online   []string         `json:"online"`
	LastSeen map[string]int64 `json:"lastSeen"`
}
