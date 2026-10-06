// Package protocol define los mensajes JSON que viajan por el websocket.
// Espejo de apps/web/src/net/protocol.ts: si cambias uno, cambia el otro.
package protocol

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
}

// Presence avisa cuando alguien entra o sale.
type Presence struct {
	T        string           `json:"t"` // "presence"
	Online   []string         `json:"online"`
	LastSeen map[string]int64 `json:"lastSeen"`
}
