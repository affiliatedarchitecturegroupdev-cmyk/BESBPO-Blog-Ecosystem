# Syndication Distribution Service (Go) — Coolify-deployed, Doc-04 Section 4
#
# NOTE: this repo ships without a go.sum (see the note in go.mod — it was
# authored with no Go toolchain or network access available). `go mod tidy`
# below both fetches dependencies AND generates go.sum; once that's been
# run once and go.sum is committed, switch this back to `go mod download`
# for faster, reproducible builds.
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY . .
RUN go mod tidy && go build -o /out/syndication-svc .

FROM alpine:3.20
COPY --from=build /out/syndication-svc /usr/local/bin/syndication-svc
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/syndication-svc"]
