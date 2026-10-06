package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT") // Railway lo inyecta
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("quack"))
	})

	log.Printf("server listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
