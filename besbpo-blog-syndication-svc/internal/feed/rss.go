package feed

import (
	"fmt"
	"strings"
	"time"
)

// BuildRSSFeed renders a Feed as an RSS 2.0 document, for
// GET /api/v1/feed/{tenantId}.rss (Doc-02 Section 5). Deliberately mirrors
// the equivalent TypeScript builder in besbpo-blog-web's lib/rss.ts —
// same escaping approach, same channel shape — so the two feed formats
// this platform produces (this one, and blog.besbpo.co.za's own
// app/feed.xml) stay recognisably consistent for anyone reading both.
func BuildRSSFeed(f Feed) string {
	var items strings.Builder
	for _, a := range f.Articles {
		items.WriteString("    <item>\n")
		items.WriteString(fmt.Sprintf("      <title>%s</title>\n", escapeXML(a.Title)))
		items.WriteString(fmt.Sprintf("      <link>%s</link>\n", escapeXML(a.CanonicalURL)))
		items.WriteString(fmt.Sprintf("      <guid isPermaLink=\"true\">%s</guid>\n", escapeXML(a.CanonicalURL)))
		items.WriteString(fmt.Sprintf("      <description>%s</description>\n", escapeXML(a.Excerpt)))
		items.WriteString(fmt.Sprintf("      <pubDate>%s</pubDate>\n", a.PublishedAt.Format(time.RFC1123Z)))
		items.WriteString("    </item>\n")
	}

	channelTitle := fmt.Sprintf("Besbpo Group Blog — tenant feed (%s)", f.TenantID)

	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>%s</title>
    <link>https://blog.besbpo.co.za</link>
    <description>Syndicated feed for a Besbpo Group subsidiary site.</description>
    <lastBuildDate>%s</lastBuildDate>
%s  </channel>
</rss>
`, escapeXML(channelTitle), f.GeneratedAt.Format(time.RFC1123Z), items.String())
}

var xmlEscaper = strings.NewReplacer(
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	`"`, "&quot;",
	"'", "&apos;",
)

func escapeXML(s string) string {
	return xmlEscaper.Replace(s)
}
