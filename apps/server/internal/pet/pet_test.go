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
