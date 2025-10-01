mod decoder;
mod file_ops;
mod formats;
mod gui;
mod migrator;

use std::path::PathBuf;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() == 1 || args.contains(&"--gui".to_string()) {
        if let Err(e) = gui::run_gui() {
            eprintln!("GUI Error: {}", e);
            std::process::exit(1);
        }
        return;
    }
    
    let directory = if args.len() > 1 && !args[1].starts_with("--") {
        PathBuf::from(&args[1])
    } else {
        PathBuf::from(".")
    };
    
    let skip_backup = args.contains(&"--skip-backup".to_string());
    
    println!("Scanning directory: {}", directory.display());
    
    match migrator::migrate_directory(&directory, skip_backup) {
        Ok(count) => println!("Successfully migrated {} files", count),
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
