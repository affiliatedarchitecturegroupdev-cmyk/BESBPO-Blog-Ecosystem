package tenant

import "testing"

func TestTenant_HasAnyDivision(t *testing.T) {
	cases := []struct {
		name             string
		tenantDivisions  []string
		articleDivisions []string
		want             bool
	}{
		{"exact overlap", []string{"logistics"}, []string{"logistics"}, true},
		{"partial overlap", []string{"logistics", "bpo"}, []string{"construction", "bpo"}, true},
		{"no overlap", []string{"real-estate"}, []string{"logistics"}, false},
		{"empty tenant subscription", []string{}, []string{"logistics"}, false},
		{"empty article divisions", []string{"logistics"}, []string{}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tn := Tenant{DivisionTags: tc.tenantDivisions}
			got := tn.HasAnyDivision(tc.articleDivisions)
			if got != tc.want {
				t.Errorf("HasAnyDivision() = %v, want %v", got, tc.want)
			}
		})
	}
}
