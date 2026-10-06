package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/omaradriano/sayitwithquack/server/internal/hub"
	"github.com/omaradriano/sayitwithquack/server/internal/store"
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

	// Dónde se guarda state.json. En Railway: un volumen montado en /data.
	dataDir := env("DATA_DIR", "data")
	st, err := store.New(dataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	h, err := hub.New(ducks, origins, st)
	if err != nil {
		log.Fatalf("hub: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("quack"))
	})
	mux.Handle("GET /ws", h)

	log.Printf("server listening on :%s (ducks=%v origins=%v data=%s)", port, ducks, origins, dataDir)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
