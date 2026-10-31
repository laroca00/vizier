use std::path::Path;
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

const DEFAULT_INSTALL_DIR: &str = r"C:\Riot Games\League of Legends";
const CLIENT_PROCESS: &str = "LeagueClientUx.exe";
// Reading other processes' command lines is not free; the lockfile covers the
// common install path, so the scan only runs this often.
const PROCESS_SCAN_INTERVAL: Duration = Duration::from_secs(10);

#[derive(Clone, PartialEq, Eq)]
pub struct Credentials {
    pub port: u16,
    password: String,
}

impl Credentials {
    pub fn authorization(&self) -> String {
        format!("Basic {}", STANDARD.encode(format!("riot:{}", self.password)))
    }
}

/// `LeagueClient:<pid>:<port>:<password>:<protocol>`
fn parse_lockfile(contents: &str) -> Option<Credentials> {
    let mut parts = contents.trim().split(':');
    let port = parts.nth(2)?.parse().ok()?;
    let password = parts.next()?.to_owned();
    Some(Credentials { port, password })
}

fn from_lockfile(install_dir: &Path) -> Option<Credentials> {
    let contents = std::fs::read_to_string(install_dir.join("lockfile")).ok()?;
    parse_lockfile(&contents)
}

fn arg_value<'a>(args: &'a [String], key: &str) -> Option<&'a str> {
    args.iter().find_map(|arg| arg.strip_prefix(key))
}

pub struct Finder {
    // None when process listing is unavailable; the lockfile still works.
    system: Option<System>,
    last_scan: Option<Instant>,
}

impl Finder {
    pub fn new() -> Self {
        Self { system: System::new().ok(), last_scan: None }
    }

    pub fn find(&mut self) -> Option<Credentials> {
        if let Some(credentials) = from_lockfile(Path::new(DEFAULT_INSTALL_DIR)) {
            return Some(credentials);
        }
        if self.last_scan.is_some_and(|at| at.elapsed() < PROCESS_SCAN_INTERVAL) {
            return None;
        }
        self.last_scan = Some(Instant::now());
        self.from_process()
    }

    /// For installs outside the default path: the client's command line carries
    /// the same port and token.
    fn from_process(&mut self) -> Option<Credentials> {
        let system = self.system.as_mut()?;
        system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
        let pid = system
            .processes()
            .iter()
            .find(|(_, process)| process.name().eq_ignore_ascii_case(CLIENT_PROCESS))
            .map(|(pid, _)| *pid)?;
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            true,
            ProcessRefreshKind::nothing().with_cmd(UpdateKind::Always),
        );
        let args: Vec<String> = system
            .process(pid)?
            .cmd()
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();

        if let Some(dir) = arg_value(&args, "--install-directory=") {
            if let Some(credentials) = from_lockfile(Path::new(dir)) {
                return Some(credentials);
            }
        }
        let port = arg_value(&args, "--app-port=")?.parse().ok()?;
        let password = arg_value(&args, "--remoting-auth-token=")?.to_owned();
        Some(Credentials { port, password })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lockfile() {
        let credentials = parse_lockfile("LeagueClient:1234:50879:s3cr3t:https\n").unwrap();
        assert_eq!(credentials.port, 50879);
        assert_eq!(credentials.authorization(), format!("Basic {}", STANDARD.encode("riot:s3cr3t")));
    }

    #[test]
    fn rejects_malformed_lockfile() {
        assert!(parse_lockfile("LeagueClient:1234").is_none());
        assert!(parse_lockfile("LeagueClient:1234:notaport:x:https").is_none());
    }
}
