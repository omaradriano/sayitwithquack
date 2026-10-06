// Package store guarda el estado del estanque en un archivo JSON,
// para que sobreviva a reinicios y despliegues (en Railway vive en un volumen).
package store

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/omaradriano/sayitwithquack/server/internal/protocol"
)

// Data es todo lo que se persiste.
type Data struct {
	Configs  map[string]protocol.Config `json:"configs"`
	LastSeen map[string]int64           `json:"lastSeen"`
	States   map[string]protocol.State  `json:"states"`
}

type Store struct {
	path string
}

// New usa dir/state.json; crea el directorio si no existe.
func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{path: filepath.Join(dir, "state.json")}, nil
}

// Load lee el archivo. Si todavía no existe, devuelve datos vacíos.
func (s *Store) Load() (*Data, error) {
	d := &Data{}
	raw, err := os.ReadFile(s.path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	if err == nil {
		if err := json.Unmarshal(raw, d); err != nil {
			return nil, err
		}
	}
	if d.Configs == nil {
		d.Configs = map[string]protocol.Config{}
	}
	if d.LastSeen == nil {
		d.LastSeen = map[string]int64{}
	}
	if d.States == nil {
		d.States = map[string]protocol.State{}
	}
	return d, nil
}

// Save escribe de forma atómica: primero a un temporal y luego lo renombra,
// así nunca queda un archivo a medio escribir si el servidor se cae.
func (s *Store) Save(d *Data) error {
	raw, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
