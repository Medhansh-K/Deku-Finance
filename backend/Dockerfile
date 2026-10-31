FROM rust:1.88-bookworm AS build
WORKDIR /app
# Build dependencies against a dummy main first so this layer is reused until Cargo.toml/Cargo.lock change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
# touch: the real main.rs may be older than the dummy's build artefacts
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home deku
COPY --from=build /app/target/release/deku-backend /usr/local/bin/deku-backend
USER deku
ENV PORT=8080
EXPOSE 8080
CMD ["deku-backend"]
