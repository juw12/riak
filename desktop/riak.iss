; Riak for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Riak> /DOutputDir=<dist> /DIconFile=<build\riak.ico> riak.iss
; Installs to %LOCALAPPDATA%\Programs\Riak, adds Riak to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Riak, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Riak"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\riak.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Riak
AppVersion={#AppVersion}
AppVerName=Riak {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/riak/
AppSupportURL=https://github.com/juw12/riak
DefaultDirName={autopf}\Riak
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Riak-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Riak.exe
UninstallDisplayName=Riak
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Riak"; Filename: "{app}\Riak.exe"; Comment: "A free, offline aquarium you care for: planted tanks"
Name: "{userdesktop}\Riak"; Filename: "{app}\Riak.exe"; Comment: "A free, offline aquarium you care for: planted tanks"; Tasks: desktopicon

[Run]
Filename: "{app}\Riak.exe"; Description: "{cm:LaunchProgram,Riak}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Riak.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopRiak"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Riak window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Riak.exe')) then
    Exec(ExpandConstant('{app}\Riak.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
