//! Minimal HTTP/1.1 server built on the standard library only.
//!
//! Phase 0 deliberately avoids pulling in axum/actix-web so this service has
//! zero external dependencies to fetch before OpenHands has network access
//! to crates.io. Replace this module with a real framework in Phase 1
//! (Doc-05) once that's no longer a constraint — the `Request`/`Response`
//! shapes below are intentionally minimal so that swap is mechanical.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};

use crate::rate_limit::RateLimiter;

pub struct Request {
    pub method: String,
    pub path: String,
    pub query: HashMap<String, String>,
}

pub struct Response {
    pub status: u16,
    pub body: String,
    pub content_type: &'static str,
}

impl Response {
    pub fn json(status: u16, body: impl Into<String>) -> Self {
        Response { status, body: body.into(), content_type: "application/json" }
    }
}

pub type Handler = fn(&Request) -> Response;

/// Blocking, single-threaded accept loop. Adequate for Phase 0 health checks
/// and low-volume search queries; revisit (thread-per-connection or a real
/// async runtime) before this carries production search traffic.
///
/// `rate_limiter` is applied to every route except `/healthz` — matching
/// the same hardcoded healthz exemption convention used elsewhere in this
/// platform (e.g. besbpo-blog-enterprise-svc's ServiceJwtAuthFilter):
/// orchestration/monitoring tools need to poll health checks frequently,
/// so those shouldn't compete with real traffic for the same rate budget.
/// See rate_limit.rs for why this endpoint is rate-limited rather than
/// authenticated.
pub fn serve(addr: &str, routes: &[(&str, &str, Handler)], rate_limiter: &RateLimiter) -> std::io::Result<()> {
    let listener = TcpListener::bind(addr)?;
    println!("listening on {addr}");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                if let Err(e) = handle_connection(stream, routes, rate_limiter) {
                    eprintln!("connection error: {e}");
                }
            }
            Err(e) => eprintln!("accept error: {e}"),
        }
    }
    Ok(())
}

fn handle_connection(
    mut stream: TcpStream,
    routes: &[(&str, &str, Handler)],
    rate_limiter: &RateLimiter,
) -> std::io::Result<()> {
    // Captured before the stream is handed to a BufReader below — a
    // TcpStream's peer address doesn't change over its lifetime, but
    // grabbing it up front keeps this independent of whatever the
    // reading code below does to the stream.
    let client_ip = stream
        .peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let peek_reader = stream.try_clone()?;
    let mut reader = BufReader::new(peek_reader);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    if request_line.is_empty() {
        return Ok(());
    }

    // Drain headers; Phase 0 endpoints are GET-only with no body to parse.
    loop {
        let mut line = String::new();
        let bytes_read = reader.read_line(&mut line)?;
        if bytes_read == 0 || line == "\r\n" || line == "\n" {
            break;
        }
    }

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let raw_path = parts.next().unwrap_or("/").to_string();
    let (path, query) = split_path_and_query(&raw_path);

    if path != "/healthz" && !rate_limiter.allow(&client_ip) {
        let response = Response::json(429, r#"{"error":"rate limit exceeded"}"#);
        return write_response(&mut stream, response);
    }

    let request = Request { method: method.clone(), path: path.clone(), query };

    let response = routes
        .iter()
        .find(|(m, p, _)| *m == method && *p == path)
        .map(|(_, _, handler)| handler(&request))
        .unwrap_or(Response::json(404, r#"{"error":"not found"}"#));

    write_response(&mut stream, response)
}

fn split_path_and_query(raw_path: &str) -> (String, HashMap<String, String>) {
    let mut query = HashMap::new();
    if let Some((path, query_str)) = raw_path.split_once('?') {
        for pair in query_str.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                query.insert(k.to_string(), v.to_string());
            }
        }
        (path.to_string(), query)
    } else {
        (raw_path.to_string(), query)
    }
}

fn write_response(stream: &mut TcpStream, response: Response) -> std::io::Result<()> {
    let status_text = match response.status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        404 => "Not Found",
        429 => "Too Many Requests",
        _ => "Internal Server Error",
    };
    let body_bytes = response.body.as_bytes();
    let headers = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        response.status,
        status_text,
        response.content_type,
        body_bytes.len()
    );
    stream.write_all(headers.as_bytes())?;
    stream.write_all(body_bytes)?;
    stream.flush()
}
