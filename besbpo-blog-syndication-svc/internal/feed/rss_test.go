package feed

import (
	"strings"
	"testing"
	"time"
)

func sampleFeedForRSS() Feed {
	published, _ := time.Parse(time.RFC3339, "2026-06-28T06:30:00Z")
	generated, _ := time.Parse(time.RFC3339, "2026-07-07T09:00:00Z")

	return Feed{
		TenantID:    "tenant-1",
		GeneratedAt: generated,
		Articles: []ArticleSummary{
			{
				ID:           "a-1",
				Slug:         "financing-infrastructure",
				Title:        "Financing Infrastructure",
				Excerpt:      "A look at blended finance.",
				CanonicalURL: "https://blog.besbpo.co.za/articles/financing-infrastructure",
				PublishedAt:  published,
			},
		},
	}
}

func TestBuildRSSFeed_ProducesWellFormedChannelWithOneItem(t *testing.T) {
	xml := BuildRSSFeed(sampleFeedForRSS())

	if !strings.Contains(xml, `<rss version="2.0">`) {
		t.Errorf("expected an RSS 2.0 root element, got:\n%s", xml)
	}
	if !strings.Contains(xml, "tenant-1") {
		t.Errorf("expected the tenant id to appear in the channel title, got:\n%s", xml)
	}
	if got := strings.Count(xml, "<item>"); got != 1 {
		t.Errorf("expected exactly 1 <item>, got %d", got)
	}
}

func TestBuildRSSFeed_EscapesXMLSignificantCharacters(t *testing.T) {
	f := sampleFeedForRSS()
	f.Articles[0].Title = `R&D <Notes> "quoted"`

	xml := BuildRSSFeed(f)

	if strings.Contains(xml, `R&D <Notes>`) {
		t.Errorf("expected title to be escaped, but found unescaped content in:\n%s", xml)
	}
	if !strings.Contains(xml, "R&amp;D &lt;Notes&gt;") {
		t.Errorf("expected escaped title in output, got:\n%s", xml)
	}
}

func TestBuildRSSFeed_HandlesZeroArticles(t *testing.T) {
	f := sampleFeedForRSS()
	f.Articles = []ArticleSummary{}

	xml := BuildRSSFeed(f)

	if strings.Contains(xml, "<item>") {
		t.Errorf("expected no <item> elements for an empty feed, got:\n%s", xml)
	}
	if !strings.Contains(xml, "<rss version=\"2.0\">") {
		t.Errorf("expected a valid (empty) channel, got:\n%s", xml)
	}
}

func TestBuildRSSFeed_FormatsPubDateAsRFC1123Z(t *testing.T) {
	xml := BuildRSSFeed(sampleFeedForRSS())

	// 2026-06-28T06:30:00Z formatted as RFC1123Z should read:
	// "Sun, 28 Jun 2026 06:30:00 +0000"
	if !strings.Contains(xml, "Sun, 28 Jun 2026 06:30:00 +0000") {
		t.Errorf("expected RFC1123Z-formatted pubDate, got:\n%s", xml)
	}
}
