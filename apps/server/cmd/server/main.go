package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/omaradriano/sayitwithquack/server/internal/hub"
)

// env lee una variable de entorno con valor por defecto.
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func list(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func main() {
	port := env("PORT", "8787") // Railway lo inyecta
	ducks := list(env("DUCK_IDS", "omar,mayra"))
	// Hosts desde donde se permite abrir el websocket (patrones, sin http://).
	// Siempre se permite desarrollo local y la red de casa; en Railway agrega el dominio de Vercel.
	origins := append(
		[]string{"localhost:*", "127.0.0.1:*", "192.168.*"},
		list(os.Getenv("ALLOWED_ORIGINS"))...,
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("quack"))
	})
	mux.Handle("GET /ws", hub.New(ducks, origins))

	log.Printf("server listening on :%s (ducks=%v origins=%v)", port, ducks, origins)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
