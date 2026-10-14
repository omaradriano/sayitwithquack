// Package pet tiene las reglas del hambre de los patos.
// Espejo de HUNGER en apps/web/src/config.ts: si cambias una regla, cambia las dos.
package pet

import (
	"time"
	_ "time/tzdata" // la imagen distroless no trae zonas horarias
)

const (
	FullToEmpty = 48 * time.Hour // de 100 % a 0 % en 2 días
	FeedAmount  = 30.0           // cada comida sube +30 %
	FullAt      = 90.0           // arriba de esto "¡Está lleno!"
	HungryAt    = 25.0           // abajo de esto: aviso por notificación
	FoodCost    = 0              // monedas por comida (los minijuegos lo activarán)
)

// Zone define cuándo empieza un día nuevo para el contador de días (hora de México).
var Zone = mustZone("America/Mexico_City")

func mustZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// Day es la fecha local ("2026-10-13") de un momento.
func Day(t time.Time) string {
	return t.In(Zone).Format(time.DateOnly)
}

// State guarda el hambre como "nivel en un momento dado". El hambre actual
// se calcula con el tiempo transcurrido: no hace falta restar nada cada segundo.
type State struct {
	Level   float64 `json:"level"` // 0–100 en el momento At
	At      int64   `json:"at"`    // ms Unix
	Coins   int     `json:"coins"`
	LastDay string  `json:"lastDay"` // fecha local de la última comida ("2026-10-13")
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
	s.Level = min(100, current+FeedAmount)
	s.At = now.UnixMilli()
	s.Coins -= FoodCost
	s.LastDay = Day(now)
	return s, ""
}

// Together es el contador de días compartido: sube cuando los dos alimentaron a su pato ese día.
type Together struct {
	Days    int    `json:"days"`
	LastDay string `json:"lastDay"` // último día contado
}

// Update suma un día si todos los patos ya comieron hoy y ese día aún no se contó.
func (t Together) Update(pets map[string]State, ducks []string, now time.Time) Together {
	today := Day(now)
	if t.LastDay == today {
		return t
	}
	for _, duck := range ducks {
		if pets[duck].LastDay != today {
			return t
		}
	}
	return Together{Days: t.Days + 1, LastDay: today}
}
