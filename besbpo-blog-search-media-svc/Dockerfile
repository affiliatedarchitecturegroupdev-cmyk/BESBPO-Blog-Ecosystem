# Search & Media Service (Rust) — Coolify-deployed, Doc-04 Section 4
FROM rust:1.79-slim AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=build /app/target/release/search-media-svc /usr/local/bin/search-media-svc
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/search-media-svc"]
