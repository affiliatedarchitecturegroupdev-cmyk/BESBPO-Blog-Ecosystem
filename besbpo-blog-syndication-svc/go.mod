module github.com/besbpo-group/besbpo-blog-syndication-svc

go 1.22

// PHASE 3 NOTE for OpenHands: this go.mod was authored in an environment
// with no Go toolchain and no network access (see README.md), so it could
// not be produced by `go mod tidy` and has no accompanying go.sum. Run
// `go mod tidy` as the very first step before building — it will fetch
// these two dependencies (and their transitive deps), verify the versions
// below are still current, and generate go.sum. Do not assume this file is
// otherwise trustworthy until that's been done.
require (
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/jackc/pgx/v5 v5.6.0
	github.com/redis/go-redis/v9 v9.5.3
	golang.org/x/time v0.5.0
)
