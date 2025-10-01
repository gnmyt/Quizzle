use iced::{
    alignment,
    widget::{button, checkbox, column, container, progress_bar, row, text, text_input},
    Application, Command, Element, Font, Length, Settings, Size, Theme,
};
use rfd::FileDialog;
use std::path::PathBuf;
use tokio::task;

use crate::migrator;

pub fn run_gui() -> iced::Result {
    QuizMigratorApp::run(Settings {
        window: iced::window::Settings {
            size: Size::new(600.0, 320.0),
            min_size: Some(Size::new(500.0, 250.0)),
            max_size: Some(Size::new(800.0, 400.0)),
            resizable: true,
            ..Default::default()
        },
        ..Default::default()
    })
}

#[derive(Debug, Clone)]
pub enum Message {
    SelectFolder,
    FolderSelected(Option<PathBuf>),
    DirectoryChanged(String),
    SkipBackupToggled(bool),
    StartMigration,
    MigrationCompleted(Result<usize, String>),
}

#[derive(Debug, Clone)]
pub enum MigrationState {
    Idle,
    InProgress,
    Completed(usize),
    Error(String),
}

pub struct QuizMigratorApp {
    selected_directory: String,
    skip_backup: bool,
    migration_state: MigrationState,
}

impl Application for QuizMigratorApp {
    type Message = Message;
    type Theme = Theme;
    type Executor = iced::executor::Default;
    type Flags = ();

    fn new(_flags: ()) -> (Self, Command<Message>) {
        (
            QuizMigratorApp {
                selected_directory: std::env::current_dir()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                skip_backup: false,
                migration_state: MigrationState::Idle,
            },
            Command::none(),
        )
    }

    fn title(&self) -> String {
        "Quizzle Migrator".to_string()
    }

    fn update(&mut self, message: Message) -> Command<Message> {
        match message {
            Message::SelectFolder => {
                return Command::perform(
                    async {
                        task::spawn_blocking(|| {
                            FileDialog::new()
                                .set_title("Ordner auswählen")
                                .pick_folder()
                        })
                        .await
                        .unwrap_or(None)
                    },
                    Message::FolderSelected,
                );
            }
            Message::FolderSelected(path) => {
                if let Some(path) = path {
                    self.selected_directory = path.to_string_lossy().to_string();
                }
            }
            Message::DirectoryChanged(path) => {
                self.selected_directory = path;
            }
            Message::SkipBackupToggled(value) => {
                self.skip_backup = value;
            }
            Message::StartMigration => {
                if !self.selected_directory.is_empty() {
                    self.migration_state = MigrationState::InProgress;

                    let directory = PathBuf::from(&self.selected_directory);
                    let skip_backup = self.skip_backup;

                    return Command::perform(
                        async move {
                            task::spawn_blocking(move || {
                                migrator::migrate_directory(&directory, skip_backup)
                                    .map_err(|e| e.to_string())
                            })
                            .await
                            .unwrap_or_else(|e| Err(format!("Task join error: {}", e)))
                        },
                        Message::MigrationCompleted,
                    );
                }
            }
            Message::MigrationCompleted(result) => match result {
                Ok(count) => {
                    self.migration_state = MigrationState::Completed(count);
                }
                Err(error) => {
                    self.migration_state = MigrationState::Error(error);
                }
            },
        }
        Command::none()
    }

    fn view(&self) -> Element<Message> {
        let title = text("Quizzle Migrator")
            .size(22)
            .font(Font::with_name("system-ui"))
            .horizontal_alignment(alignment::Horizontal::Center);

        let folder_section = column![
            text("Ordner auswählen:")
                .size(15)
                .font(Font::with_name("system-ui")),
            row![
                text_input("Ordnerpfad eingeben...", &self.selected_directory)
                    .on_input(Message::DirectoryChanged)
                    .width(Length::Fill)
                    .font(Font::with_name("system-ui"))
                    .size(14),
                button("Durchsuchen").on_press(Message::SelectFolder)
            ]
            .spacing(8)
        ]
        .spacing(4);

        let options_section =
            column![
                checkbox("Keine Sicherungskopie erstellen", self.skip_backup)
                    .on_toggle(Message::SkipBackupToggled)
                    .font(Font::with_name("system-ui"))
                    .size(14)
            ]
            .spacing(8);

        let start_button = match &self.migration_state {
            MigrationState::InProgress => button(
                text("Konvertiere...")
                    .horizontal_alignment(alignment::Horizontal::Center)
                    .font(Font::with_name("system-ui"))
                    .size(15),
            )
            .width(Length::Fill),
            _ => button(
                text("Migration starten")
                    .horizontal_alignment(alignment::Horizontal::Center)
                    .font(Font::with_name("system-ui"))
                    .size(15),
            )
            .on_press(Message::StartMigration)
            .width(Length::Fill),
        };

        let mut content = column![title, folder_section, options_section, start_button]
            .spacing(15)
            .padding(16);

        match &self.migration_state {
            MigrationState::InProgress => {
                content = content.push(
                    column![
                        text("Migration läuft...")
                            .size(15)
                            .font(Font::with_name("system-ui")),
                        progress_bar(0.0..=1.0, 0.5)
                    ]
                    .spacing(8),
                );
            }
            MigrationState::Completed(count) => {
                let summary = column![
                    text("Migration abgeschlossen!")
                        .size(16)
                        .font(Font::with_name("system-ui")),
                    text(format!("Erfolgreich {} Dateien migriert", count))
                        .size(13)
                        .font(Font::with_name("system-ui")),
                ]
                .spacing(3);
                content = content.push(summary);
            }
            MigrationState::Error(error) => {
                let summary = column![
                    text("Migration fehlgeschlagen!")
                        .size(16)
                        .font(Font::with_name("system-ui")),
                    text(format!("Fehler: {}", error))
                        .size(13)
                        .font(Font::with_name("system-ui")),
                ]
                .spacing(3);
                content = content.push(summary);
            }
            MigrationState::Idle => {
                content = content.push(
                    text("Noch keine Migration durchgeführt.")
                        .size(13)
                        .font(Font::with_name("system-ui"))
                        .horizontal_alignment(alignment::Horizontal::Center),
                );
            }
        }

        container(content)
            .width(Length::Fill)
            .height(Length::Fill)
            .into()
    }
}
