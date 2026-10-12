// Package pet tiene las reglas del hambre de los patos.
// Espejo de HUNGER en apps/web/src/config.ts: si cambias una regla, cambia las dos.
package pet

import "time"

const (
	FullToEmpty = 48 * time.Hour // de 100 % a 0 % en 2 días
	FeedAmount  = 30.0           // cada comida sube +30 %
	FullAt      = 90.0           // arriba de esto "¡Está lleno!"
	HungryAt    = 25.0           // abajo de esto: aviso por notificación
	FoodCost    = 0              // monedas por comida (los minijuegos lo activarán)
)

// State guarda el hambre como "nivel en un momento dado". El hambre actual
// se calcula con el tiempo transcurrido: no hace falta restar nada cada segundo.
type State struct {
	Level float64 `json:"level"` // 0–100 en el momento At
	At    int64   `json:"at"`    // ms Unix
	Coins int     `json:"coins"`
}

func New(now time.Time) State {
	return State{Level: 100, At: now.UnixMilli()}
}

// Current es el hambre en el momento now.
func (s State) Current(now time.Time) float64 {
	elapsed := time.Duration(now.UnixMilli()-s.At) * time.Millisecond
	level := s.Level - 100*elapsed.Seconds()/FullToEmpty.Seconds()
	return max(0, min(100, level))
}

// Feed devuelve el nuevo estado tras comer, o un motivo si no se puede.
func (s State) Feed(now time.Time) (State, string) {
	current := s.Current(now)
	if current > FullAt {
		return s, "full"
	}
	if s.Coins < FoodCost {
		return s, "coins"
	}
	return State{Level: min(100, current+FeedAmount), At: now.UnixMilli(), Coins: s.Coins - FoodCost}, ""
}
