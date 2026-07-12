package analytics

import "testing"

func TestValidateBeaconPayload_AcceptsAValidImpression(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{TenantID: "t-1", ArticleID: "a-1", EventType: "impression"})
	if err != nil {
		t.Fatalf("expected a valid impression payload to pass, got: %v", err)
	}
}

func TestValidateBeaconPayload_AcceptsAValidClickThrough(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{TenantID: "t-1", ArticleID: "a-1", EventType: "click_through"})
	if err != nil {
		t.Fatalf("expected a valid click_through payload to pass, got: %v", err)
	}
}

func TestValidateBeaconPayload_RejectsAnUnknownEventType(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{TenantID: "t-1", ArticleID: "a-1", EventType: "something_else"})
	if err == nil {
		t.Fatal("expected an unknown event_type to be rejected")
	}
}

func TestValidateBeaconPayload_RejectsMissingTenantID(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{ArticleID: "a-1", EventType: "impression"})
	if err == nil {
		t.Fatal("expected a missing tenant_id to be rejected")
	}
}

func TestValidateBeaconPayload_RejectsMissingArticleID(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{TenantID: "t-1", EventType: "impression"})
	if err == nil {
		t.Fatal("expected a missing article_id to be rejected")
	}
}

func TestValidateBeaconPayload_RejectsAnEmptyPayload(t *testing.T) {
	err := validateBeaconPayload(BeaconPayload{})
	if err == nil {
		t.Fatal("expected an entirely empty payload to be rejected")
	}
}
