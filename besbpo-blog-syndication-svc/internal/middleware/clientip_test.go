package middleware

import (
	"net/http"
	"testing"
)

func TestClientIP_PrefersXForwardedForFirstHop(t *testing.T) {
	req := &http.Request{Header: http.Header{}, RemoteAddr: "10.0.0.1:12345"}
	req.Header.Set("X-Forwarded-For", "203.0.113.5, 10.0.0.2, 10.0.0.1")

	got := clientIP(req)
	if got != "203.0.113.5" {
		t.Fatalf("expected the first X-Forwarded-For hop, got %q", got)
	}
}

func TestClientIP_TrimsWhitespaceAroundTheFirstHop(t *testing.T) {
	req := &http.Request{Header: http.Header{}, RemoteAddr: "10.0.0.1:12345"}
	req.Header.Set("X-Forwarded-For", "  203.0.113.5  , 10.0.0.2")

	got := clientIP(req)
	if got != "203.0.113.5" {
		t.Fatalf("expected trimmed IP, got %q", got)
	}
}

func TestClientIP_FallsBackToRemoteAddrWhenNoForwardedHeader(t *testing.T) {
	req := &http.Request{Header: http.Header{}, RemoteAddr: "192.0.2.10:54321"}

	got := clientIP(req)
	if got != "192.0.2.10" {
		t.Fatalf("expected host portion of RemoteAddr, got %q", got)
	}
}

func TestClientIP_FallsBackToRemoteAddrWhenForwardedHeaderIsEmpty(t *testing.T) {
	req := &http.Request{Header: http.Header{}, RemoteAddr: "192.0.2.10:54321"}
	req.Header.Set("X-Forwarded-For", "")

	got := clientIP(req)
	if got != "192.0.2.10" {
		t.Fatalf("expected host portion of RemoteAddr, got %q", got)
	}
}

func TestClientIP_HandlesRemoteAddrWithoutAPort(t *testing.T) {
	// SplitHostPort fails on an address with no port — the function should
	// fall back to returning RemoteAddr as-is rather than erroring.
	req := &http.Request{Header: http.Header{}, RemoteAddr: "192.0.2.10"}

	got := clientIP(req)
	if got != "192.0.2.10" {
		t.Fatalf("expected the raw RemoteAddr, got %q", got)
	}
}

func TestClientIP_HandlesAnIPv6RemoteAddr(t *testing.T) {
	req := &http.Request{Header: http.Header{}, RemoteAddr: "[2001:db8::1]:8080"}

	got := clientIP(req)
	if got != "2001:db8::1" {
		t.Fatalf("expected the IPv6 host without brackets/port, got %q", got)
	}
}
