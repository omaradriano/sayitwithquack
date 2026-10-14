package pet

import (
	"testing"
	"time"
)

func TestHungerDecays(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s := New(start)
	if got := s.Current(start.Add(24 * time.Hour)); got != 50 {
		t.Fatalf("a las 24 h esperaba 50, obtuve %v", got)
	}
	if got := s.Current(start.Add(72 * time.Hour)); got != 0 {
		t.Fatalf("nunca baja de 0, obtuve %v", got)
	}
}

func TestFeed(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s := New(start)
	if _, reason := s.Feed(start); reason != "full" {
		t.Fatalf("lleno no debería comer, reason=%q", reason)
	}
	later := start.Add(36 * time.Hour) // 25 %
	fed, reason := s.Feed(later)
	if reason != "" || fed.Level != 55 || fed.At != later.UnixMilli() {
		t.Fatalf("esperaba 55 %% sin error, obtuve %+v %q", fed, reason)
	}
	asleep := start.Add(100 * time.Hour)
	fed, _ = s.Feed(asleep)
	if fed.Level != 30 {
		t.Fatalf("dormido + comida = 30, obtuve %v", fed.Level)
	}
}

func TestTogether(t *testing.T) {
	// 8 p.m. en México (02:00 UTC del día siguiente).
	start := time.Date(2026, 1, 2, 2, 0, 0, 0, time.UTC)
	ducks := []string{"omar", "mayra"}
	hungry := State{Level: 0, At: start.UnixMilli()}
	pets := map[string]State{"omar": hungry, "mayra": hungry}
	var tg Together

	pets["omar"], _ = pets["omar"].Feed(start)
	if pets["omar"].LastDay != "2026-01-01" {
		t.Fatalf("la fecha es la de México, obtuve %q", pets["omar"].LastDay)
	}
	if tg = tg.Update(pets, ducks, start); tg.Days != 0 {
		t.Fatal("solo uno comió: no cuenta")
	}
	pets["mayra"], _ = pets["mayra"].Feed(start.Add(time.Hour))
	if tg = tg.Update(pets, ducks, start.Add(time.Hour)); tg.Days != 1 {
		t.Fatalf("los dos comieron: día 1, obtuve %+v", tg)
	}
	if tg = tg.Update(pets, ducks, start.Add(2*time.Hour)); tg.Days != 1 {
		t.Fatal("el mismo día cuenta una vez")
	}
	// Día siguiente (1 a.m.): Mayra come; falta Omar.
	next := start.Add(5 * time.Hour)
	pets["mayra"], _ = State{Level: 0, At: next.UnixMilli()}.Feed(next)
	if tg = tg.Update(pets, ducks, next); tg.Days != 1 {
		t.Fatal("ayer de Omar no cuenta para hoy")
	}
	pets["omar"], _ = State{Level: 0, At: next.UnixMilli()}.Feed(next)
	if tg = tg.Update(pets, ducks, next); tg.Days != 2 || tg.LastDay != "2026-01-02" {
		t.Fatalf("día 2, obtuve %+v", tg)
	}
}
