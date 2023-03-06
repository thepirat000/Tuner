// Defines and Consts
#define SERVICE_NAME "Tuner by ThePirat"
#define SERVICE_UUID                "fe000000-fede-fede-0000-000000000000"       // Bluetooth Service ID
#define CHARACTERISTIC_FREQ_UUID    "ca000000-fede-fede-0000-000000000001"       // Bluetooth characteristic to get the current frequencies of the oscillators in Hertz
#define CHARACTERISTIC_DUTY_UUID    "ca000000-fede-fede-0000-000000000002"       // Bluetooth characteristic to get the duties of the oscillators (0 to 1023)
#define CHARACTERISTIC_SWITCH_UUID  "ca000000-fede-fede-0000-000000000003"       // Bluetooth characteristic to get the switched of the oscillators (0 or 1)
#define CHARACTERISTIC_PRESET_UUID  "ca000000-fede-fede-0000-000000000004"       // Bluetooth characteristic to get the preset loaded (preset index)
#define CHARACTERISTIC_CMD_UUID     "ca000000-fede-fede-0000-000000000099"       // Bluetooth characteristic to send commands and get the current status 

#define PRESET_FILE_PREFIX "/p"
#define PRESET_FILE_SUFFIX ""

#define INIT_FILE "/init"

#define LED_PIN 2
#define MAX_PRESET 8  // Presets MAX count
#define MAX_OUTPUT 4  // Oscillators MAX count (up to 8)
#define MAX_FREQUENCY 40000
#define DUTY_RESOLUTION_BITS 10
#define DUTY_CYCLE_DEFAULT 512

// Connect each of these PINS to a MOSFET driving 12v to a coil/electromaget (i.e. D2, D4, D5, D18, etc)
const int PINOUT[] = {2, 4, 5, 18, 19, 21, 22, 23 }; 
// GPIO13 as Touch pin, to allow bypassing the INIT command in case it's needed
const int TOUCHPIN = 13;

// Preloaded songs. (Format: Check README.md)
const std::vector<String> SONGS = {
  "M.5,.33,.5,.33:4|.33,.5,.33,.5:4|.25,2,.25,2:2.5|2,.25,2,.25:4|1.5,3,1.5,3:2|3,1.5,3,1.5:4|1,2,1,2:4|.125,.125,.125,.125:2|4,2,4,2:2|.5,4,.5,4:2|1.5,3,1.5,3:2",
  "M1.5,1,2,2:2|3,1.5,1.5,1:2|2,1.25,2,2:1.5|2,2,.5,3:2|.5,3,2,2:1|3,.5,1,2:1|1,2,3,.5:3|3,3,4,2:1|4,2,3,3:.5|.5,2.5,2.5,5:.5|2.5,.5,.5,2.5:.5",
  "a-1,-1,-1,-1:1|=1|=1|=1|=1|a1,1,1,1:1|=6|=6|=6|=6|=6|=6|=6|=6|=6|=1|=1|=1|=1|=1",
  "a-1,1,-1,1:1|=1|=1|=1|=1|a1,-1,1,-1:1|=6|=6|=6|=6|=6|=6|=6|=6|=6|=1|=1|=1|=1|=1"
};

// Prototypes
void setup(void);
void loop(void);
std::vector<float> splitParseVector(String msg, float def, std::vector<float> *completeWith=nullptr);
std::vector<String> splitString(String msg, const char delim);
const char* join(std::vector<float> &v);
void NotifyBLEFreqValue();
void NotifyBLEDutyValue();
void NotifyBLEPresetLoaded();
void PrintValues(std::vector<float> &f, std::vector<float> &d);
void AttachOutputPins();
void DetachOutputPins();
void UpdateFrequencyValues(String newValue, bool isIncrement);
void UpdateDutyValues(String newValue, bool isIncrement);
void SetFreqsPWM();
void MultiplyFreqsPWM(std::vector<float> &mult);
void SetDutiesPWM();
void ProcessPlayCommand(String command);
void ProcessSeqCommand(String command);
void ProcessSoloCommand(int pindex);
void PlaySong(int songIndex, int repeat, float tempoDivider, int variation);
void PlaySongFile(String fileName, int repeat, float speed, int variation);
void PlaySongString(String song, int repeat, float speed, int variation);
void Log(String msg);
std::vector<std::string> SplitStringByNumber(const std::string &str, int len);
void SetFreqPWM(int oscIndex, float freq, bool setup=false);
std::vector<String> GetPreset(int pindex);
void StorePreset(int pindex, std::vector<String> preset);
void InitializeVectors();
void PlayPresetSequence(int startIndex, int endIndex, float interval, int repeat, int variation);
std::vector<int> GetPresetRange(int startIndex, int endIndex);
String GetInitCommand();
String GetFileContents(String fileName, String defaultValue = "");
void StoreInitCommand(String cmd);
void HandleBluetoothReconnect();
void ProcessRepeatCommand(String command);
void Repeat(int times, String commandsString);
void ProcessDelayCommand(String delayCommand);
void ProcessLoopCommand(String command);
void InitializeFileSystem();
void ProcessFileSystemCommand(String command, String fileName="", String contents="");
bool ExecuteMultiCommand(String commands);
String ReplaceParams(String command, std::vector<String> &parameters);
void ProcessExecCommand(String argument);