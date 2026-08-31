mod abi;
mod cache;
mod compiler;
mod config;
mod errors;
mod freshness;
mod handlers;
mod identity;
mod models;
mod pagination;
mod parsing;
mod proxy;
mod rpc;
mod verification;

use axum::{
    extract::FromRef,
    routing::{get, post},
    Router,
};
use handlers::{
    balances_handler, build_freshness_handler, call_function_handler,
    deployment_events_handler, functions_handler, get_instances_handler,
    integrity_check_handler, recompile_handler, chains_handler,
    proxy_info_handler, contract_family_handler
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::catch_panic::CatchPanicLayer;
use cache::IntegrityCache;
use config::Config;
use models::ContractInstance;
use std::sync::Arc;

#[cfg(feature = "embed-frontend")]
mod frontend {
    use rust_embed::RustEmbed;

    #[derive(RustEmbed, Clone)]
    #[folder = "../web/dist"]
    pub struct Assets;
}

fn warn_missing_explorer_urls(instances: &[ContractInstance], config: &Config) {
    let mut chains: Vec<u64> = instances.iter().map(|i| i.chain).collect();
    chains.sort_unstable();
    chains.dedup();

    for chain in chains {
        if config.rpc_url(chain).is_some() && config.explorer_url(chain).is_none() {
            eprintln!(
                "Warning: chain {chain} has no explorer_url configured — explorer links will be omitted for this chain."
            );
        }
    }
}

const DEFAULT_PORT: u16 = 3001;
const MAX_PORT_ATTEMPTS: u16 = 10;

async fn bind_with_fallback(requested_port: Option<u16>) -> Result<(tokio::net::TcpListener, u16), Box<dyn std::error::Error>> {
    let start_port = requested_port.unwrap_or(DEFAULT_PORT);

    for offset in 0..MAX_PORT_ATTEMPTS {
        let port = start_port + offset;
        match tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
            Ok(listener) => {
                if offset > 0 {
                    eprintln!(
                        "Warning: port {start_port} was already in use — using port {port} instead."
                    );
                }
                return Ok((listener, port));
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => continue,
            Err(e) => return Err(e.into()),
        }
    }

    Err(format!(
        "Could not find an available port after trying {start_port}-{}. \
         Free one up, or set \"port\" explicitly in registry.config.json.",
        start_port + MAX_PORT_ATTEMPTS - 1
    ).into())
}

#[derive(Clone)]
struct AppState {
    config: Arc<Config>,
    cache: Arc<IntegrityCache>,
}

impl FromRef<AppState> for Arc<Config> {
    fn from_ref(state: &AppState) -> Self {
        state.config.clone()
    }
}

impl FromRef<AppState> for Arc<IntegrityCache> {
    fn from_ref(state: &AppState) -> Self {
        state.cache.clone()
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::load_from_cwd().unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(1);
    });
    let config = Arc::new(config);

    if let Ok(instances) = parsing::load_all_instances(&config.broadcast_path, &config.out_path) {
        warn_missing_explorer_urls(&instances, &config);
    }

    let cache = Arc::new(IntegrityCache::load());
    let app_state = AppState { config: config.clone(), cache };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = Router::new()
        .route("/instances", get(get_instances_handler))
        .route("/integrity-check", get(integrity_check_handler))
        .route("/balances", get(balances_handler))
        .route("/deployment-events", get(deployment_events_handler))
        .route("/build-freshness", get(build_freshness_handler))
        .route("/recompile", post(recompile_handler))
        .route("/functions", get(functions_handler))
        .route("/call-function", post(call_function_handler))
        .route("/chains", get(chains_handler))
        .route("/proxy-info", get(proxy_info_handler))
        .route("/contract-family", get(contract_family_handler))
        .with_state(app_state);

    #[allow(unused_mut)]
    let mut app = Router::new()
        .nest("/v1", api_routes)
        .layer(cors)
        .layer(CatchPanicLayer::new());

    #[cfg(feature = "embed-frontend")]
    {
        use axum_embed::{FallbackBehavior, ServeEmbed};
        let serve_assets = ServeEmbed::<frontend::Assets>::with_parameters(
            Some("index.html".to_string()),
            FallbackBehavior::Ok,
            Some("index.html".to_string()),
        );
        app = app.fallback_service(serve_assets);
        println!("Frontend embedded and served from this binary");
    }

    let (listener, port) = bind_with_fallback(config.port).await?;
    println!("Server running on http://127.0.0.1:{port}");
    axum::serve(listener, app).await?;

    Ok(())
}