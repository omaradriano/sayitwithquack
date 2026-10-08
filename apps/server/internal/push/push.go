// Package push envía notificaciones Web Push (iPhone con la app en pantalla de inicio, Android, desktop).
package push

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/SherClockHolmes/webpush-go"
)

// Keys es el par de llaves VAPID que identifica a este servidor ante Apple/Google.
type Keys struct {
	Public  string `json:"public"`
	Private string `json:"private"`
}

func GenerateKeys() (Keys, error) {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	return Keys{Public: pub, Private: priv}, err
}

// Payload es lo que recibe el service worker (apps/web/public/sw.js).
type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	// Tag: notificaciones con el mismo tag se reemplazan en vez de apilarse.
	Tag string `json:"tag,omitempty"`
}

// Options de cada envío.
type Options struct {
	TTL     int  // segundos que el servicio de push guarda el mensaje si el teléfono está apagado
	Urgent  bool // pide entrega inmediata aunque haya poca batería
	Subject string
}

// Send manda un push. gone = true si la suscripción ya no existe (hay que borrarla).
func Send(ctx context.Context, keys Keys, sub webpush.Subscription, p Payload, o Options) (gone bool, err error) {
	msg, err := json.Marshal(p)
	if err != nil {
		return false, err
	}
	urgency := webpush.UrgencyNormal
	if o.Urgent {
		urgency = webpush.UrgencyHigh
	}
	resp, err := webpush.SendNotificationWithContext(ctx, msg, &sub, &webpush.Options{
		Subscriber:      o.Subject,
		VAPIDPublicKey:  keys.Public,
		VAPIDPrivateKey: keys.Private,
		TTL:             o.TTL,
		Urgency:         urgency,
	})
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return true, nil // el usuario desinstaló la app o revocó el permiso
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return false, fmt.Errorf("push %d: %s", resp.StatusCode, body)
	}
	return false, nil
}
