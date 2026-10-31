use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;

use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, ServerName};
use rustls::{ClientConfig, RootCertStore};
use serde::de::DeserializeOwned;
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;
use tokio_rustls::client::TlsStream;
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::AUTHORIZATION;

use super::credentials::Credentials;

pub type Error = Box<dyn std::error::Error + Send + Sync>;

// Riot's CA from developer.riotgames.com/docs/lol. It is the only root this
// config trusts, and the config is only used for the local client.
const RIOT_ROOT: &[u8] = include_bytes!("../../certs/riotgames.pem");

pub fn tls_config() -> Result<Arc<ClientConfig>, Error> {
    let mut roots = RootCertStore::empty();
    roots.add(CertificateDer::from_pem_slice(RIOT_ROOT)?)?;
    let config = ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()?
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(Arc::new(config))
}

/// Typed access to the LCU REST API. Endpoints change between patches, so all
/// calls go through here.
pub struct LcuClient {
    http: reqwest::Client,
    base: String,
    authorization: String,
}

impl LcuClient {
    pub fn new(tls: &ClientConfig, credentials: &Credentials) -> Result<Self, Error> {
        let http = reqwest::Client::builder().use_preconfigured_tls(tls.clone()).build()?;
        Ok(Self {
            http,
            base: format!("https://127.0.0.1:{}", credentials.port),
            authorization: credentials.authorization(),
        })
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, Error> {
        let response = self
            .http
            .get(format!("{}{path}", self.base))
            .header(AUTHORIZATION, &self.authorization)
            .send()
            .await?
            .error_for_status()?;
        Ok(response.json().await?)
    }
}

pub type EventStream = WebSocketStream<TlsStream<TcpStream>>;

pub async fn connect_events(tls: Arc<ClientConfig>, credentials: &Credentials) -> Result<EventStream, Error> {
    let tcp = TcpStream::connect((Ipv4Addr::LOCALHOST, credentials.port)).await?;
    let stream = TlsConnector::from(tls)
        .connect(ServerName::IpAddress(IpAddr::V4(Ipv4Addr::LOCALHOST).into()), tcp)
        .await?;
    let mut request = format!("wss://127.0.0.1:{}/", credentials.port).into_client_request()?;
    request.headers_mut().insert(AUTHORIZATION, credentials.authorization().parse()?);
    let (socket, _) = tokio_tungstenite::client_async(request, stream).await?;
    Ok(socket)
}
