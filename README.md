# About this project

An Arduino project to control up to 8 PWM outputs of an ESP32 microcontroller via bluetooth BLE. The ESP32 PWM outputs can be connected to a MOSFET in order to handle higher voltages (i.e. a 12v solenoid)

The frequencies and duty cycles can be configured independently for each of the outputs. 

A web page (HTML, JavaScript) is provided to connect to the ESP32 via bluetooth: https://thepirat000.github.io/Tuner/

![image](https://user-images.githubusercontent.com/9836380/136728030-9904a474-4f59-4258-b943-739931371db5.png)


# BLE UUID

- SVC UUID: ca000000-fede-fede-0000-000000000000
- FREQ UUID: ca000000-fede-fede-0000-000000000001
- DUTY UUID: ca000000-fede-fede-0000-000000000002
- SWITCHES UUID: ca000000-fede-fede-0000-000000000003
- CMD UUID: ca000000-fede-fede-0000-000000000099

Demo: https://thepirat000.github.io/Tuner/

# Commands

## Frequencies

### Set the frequency for oscillators in Hertz

- Format: _d[,d[,d[,d]]]_
- Being: d=decimal number 
   - d > 0: frequency in Hertz
   - d = 0: turn off the oscillator
   - d < 0: no change in frequency

Examples:

- Sets the current oscillator frequencies to 99.5, 440, 45, and 72 Hz respectively:
`99.5,440,45,72`

- Sets the OSC 1 frequency to 98.7 Hz:
`98.7`

- Sets the OSC 2 frequency to 100 Hz, but leave the others with the current frequency:
`-1,100`

same as:
`-1,100,-1,-1`

> The frequency set does not trigger the frequency values saving to the config file.

### Multipliers (*)

- Format: _*d[,d[,d[,d]]]_
- Being: d=decimal number 
   - d > 0: number to multiply the current frequency
   - d = 0: turn off the oscillator
   - d < 0: multiply the base frequency from config by ABS(d)

Examples:

- Multiply the current oscillator frequencies by 2, 0.5, 4 and 3 respectively:
`*2,.5,4,3`

- Multiply the frequency of OSC 1 by 0.125:
`*0.125`

- Set the frequency of OSC 1 to the last written config value multiplied by 2.5:
`*-2.5`

### Increments (+)

- Format: _+d[,d[,d[,d]]]_
- Being: d=decimal number 
   - d > 0: increment the frequency in d hertz
   - d = 0: no imcrement
   - d < 0: decrement the frequency in -d hertz
	   
Examples:

- Increment the current oscillator frequencies by 100, -50, 20 and 30 Hertz respectively:
`+100,-50,20,30`

- Decrement the  oscillator frequency of OSC 1 by 100 Hertz:
`+-100`

## Duties (/)

### Set the duty cycles for oscillators

- Format: _/d[,d[,d[,d]]]_
- Being: d=decimal number 
   - d > 0: duty for the oscillator (1-1023)
   - d = 0: turn off the oscillator (0% duty)
   - d < 0: no change in duty

Examples:

- Set the duties to 512 for all the oscillators:
`/512,512,512,512`

- Set the duty for OSC 1 to 900:
`/900`

- Set the duty for OSC 1 to 900 and OSC 4 to 400:
`/900,-1,-1,400`

## File system low-level commands

### Dir
List all files in flash memory

- Format: _dir_

Example:
`dir`

### Type
Logs the content of a file

- Format: _type [fileName]_
- Being 
	- fileName: the full file name (cannot contain spaces)

Example:
`type /init.cmd`

### Del
Deletes a file

- Format: _del [fileName]_
- Being 
	- fileName: the full file name to delete (cannot contain spaces)

Example:
`del /p0`

### Create
Creates a new file

- Format: _create [fileName] [contents]_
- Being 
	- fileName: the full file name to create (cannot contain spaces)
	- contents: the textual contents of the file

Examples:

Create a preset file:
`create /p0 220,440,620,840|512,512,512,512|1111`

The preset file can be loaded with "load" command: `load 0`

Create a song file:
`create /song1 mF440,520:1:512,512|2,1.5:1|f460,540:2|a1,1:1|=4|A10:1|L0`

The song file can be played with "play" command: `play /song1`

Create a command file:
`create /up-down repeat 10|+1|delay 0.2 ; repeat 10|+-1|delay 0.2 ; off`

The command file can be executed with "exec" command: `exec /up-down`

## Generic commands

### Switch oscillators 

#### Turn off (off)
Turn off an oscillator
- Format: _off [n]_
- Being 
	- n > 0: the oscillator number to turn off
	- n missing: turn off all the oscillators (default)

Example:
`off 1`

Will turn off the first oscillator

#### Turn on (on)
Turn on an oscillator
- Format: _on [n]_
- Being: 
	- n > 0: the oscillator number to turn on
	- n missing: turn off all the oscillators (default)

Example:
`on 1`

Will turn on the first oscillator


### Presets

#### Save
Will save the current frequencies, duties and switches to a preset file

- Format: _save i_
- Being:
	- i >= 0: Preset index (default is 0)

Example:
`save 0`

#### Load
Will load and set the frequency, duty, and switches values from the preset file 
- Format: _load i_
- Being:
	- i >= 0: Preset index (default is 0)

Example:
`load 0`

#### Presets format

- Format: _f,f,f,f|d,d,d,d|ssss_
- Being:
	- f: Frequency values
	- d: Duty values
	- s: switch value

### Songs

#### Play a song by index (play)

- Format: _play SongIndex[,Iterations[,Speed[,Variation]]]_
- Being: 
	- SongIndex=The song index to play
	- Iterations=Times to repeat the song (default is 1)
		- value>0: Times to repeat
		- value<=0: Repeat forever until it's stopped
	- Speed=(optional) Speed to play at (1 is normal speed, 2 is double speed, 0.5 is half speed) (default is 1)
		- value>0: Multiply speed by x
	- Variation=(optional) number:
		- value>0: randomize the steps order with the given number as seed. 
		- value=0: pseudo randomize steps
		- value<0: no randomizing (default)

Examples:

- Play the song at index 0, no repetition, at normal speed
`play 0`

- Play the song at index 1, repeat 10 times, at 5x speed
`play 1,10,5`

- Play the song at index 1, repeat 20 times, at 4x speed, with pseudo-random steps order
`play 1,20,4,0`

- Play the song at index 0, Repeat 2 times, at 1.5x speed, using a randomization for the steps with seed = 5
`play 0,2,1.5,5`

#### Play a song by file name (play)
- Format: _play SongFileName[,Iterations[,Speed[,Variation]]]_
- Being: 
	- SongFileName=The song full file name (the file must exists, can be created with CREATE command)
	- Iterations=Times to repeat the song (default is 1)
		- value>0: Times to repeat
		- value<=0: Repeat forever until it's stopped
	- Speed=(optional) Speed to play at (1 is normal speed, 2 is double speed, 0.5 is half speed) (default is 1)
		- value>0: Multiply speed by x
	- Variation=(optional) number:
		- value>0: randomize the steps order with the given number as seed. 
		- value=0: pseudo randomize steps
		- value<0: no randomizing (default)

Examples:

- Play the song at file song1, no repetition, at normal speed
`play song1`

- Play the song at file song2, repeat 10 times, at 5x speed
`play song2,10,5`

- Play the song at file song3, repeat 20 times, at 4x speed, with pseudo-random steps order
`play song3,20,4,0`

- Play the song at file song4, Repeat 2 times, at 1.5x speed, using a randomization for the steps with seed = 5
`play song4,2,1.5,5`

### Song format
- Format: _DefaultStepType StepsPSV_
(no space separation)

- Being
	- DefaultStepType:
		- F: Set the base and current frequency
		- f: Set the current frequency
		- M: Multiply the base frequency
		- m: Multiply the current frequency
		- A: Increment the base frequency
		- a: Increment the current frequency 

	- StepsPSV: Pipe (|) separated list of steps
		- Step format: [StepType]OperandValuesCSV:DurationInSeconds[:DutiesCSV]
		- Being
			- StepType: One of 
				- F: Set the base and current frequency
				- f: Set the current frequency
				- M: Multiply the base frequency and set current as base * operand
				- m: Multiply the current frequency
				- A: Increment the base frequency and set current as base + operand
				- a: Increment the current frequency 
				- L or l: Loads the freqs, duties and switches from a preset
				- S or s: Saves the current freqs, duties and switches values in a preset
				- =: Repeat the step #operand (first step is 1, etc)
				- NULL: If no StepType is specified, the DefaultStepType is used

### Sample Song:
`mF440,520:1:512,512|2,1.5:1|f460,540:2|a1,1:1|=4|A10:1|L0`

- Description

	- Default step type is "m" (multiply the current frequency)
		- 1st step: Set the first two oscillators base frequencies to 440 and 520 hz respectively, set the first two oscillator duties to 512, and wait 1 second
		- 2nd step: Multiply the first two oscillators current frequencies by 2 and 1.5 respectively, and wait 1 second
		- 3rd step: Set the first two oscillators current frequencies to 460 and 540 hz respectively, and wait 2 seconds
		- 4th step: Increment the first two oscillators current frequencies by 1, and wait 1 second
		- 5th step: Repeat the 4th step
		- 6th step: Set the first oscillator value as the base frequency + 10 hz, and wait 1 second
		- 7th step: Loads the preset at index 0

#### Stop playing a song (stop)
Will stop playing the current song (only available via Bluetooth)

Example:
`stop`

### Play presets sequence (seq)

- Format: _seq [StartIndex[,EndIndex[,Interval[,Iterations[,Variation]]]]]_
- Being: 
	- StartIndex=The first preset index to play (default is 0)
	- EndIndex=The last preset index to play  (default is 3)
	- Interval=Time in seconds to play each preset (default is 1 second)
	- Iterations=(optional) Times to repeat the preset loop (default is 0, forever)
		- value>0: Times to repeat
		- value<=0: Repeat forever until it's stopped
	- Variation=(optional) number:
		- value>0: randomize the steps order with the given number as seed. 
		- value=0: pseudo randomize steps
		- value<0: no randomizing (default)

Examples:

- Play the presets 0 to 3 in order, on a forever loop, one second each preset
`seq 0,3,1` 

- Play the presets 0 to 15, in random order, 5 times, ten seconds on each preset
`seq 0,15,10,5,0` 


#### Stop playing presets loop (stop)
Will stop playing the preset loop (only available via Bluetooth)

Example:
`stop`

### Repeat a command sequence (repeat)
Repeats a command sequence a given number of times

- Format: _repeat Times|Cmd1|Cmd2|...|CmdN_
- Being:
	- Times=Number of times to repeat the command sequence 
		- value>0: Times to repeat
		- value<=0: Repeat forever until it's stopped
	- CmdX=The commands to execute

Example:
`repeat 10|on|+40,25,30,10|delay 1|+-40,-25,-30,-10|delay 1|off|delay 2|`

### Loop a command sequence
Repeats a command sequence until stopped (equivalent to `repeat -1|...`)

- Format: _loop Cmd1|Cmd2|...|CmdN_
- Being:
	- CmdX=The commands to execute

Example:
`loop *2,4,2,0.5|delay 10|load 0|delay 5` 

#### Stop playing repeat sequence (stop)
Will stop playing the repeat sequence (only available via Bluetooth)

Example:
`stop`

### Multiple commands (do)
To sequentially execute commands given as a semicolon (;) separated list of commands.

- Format: _do cmd1;cmd2;..._
- Being:
	- cmdx: Any valid command (except the commands "do", "create", "exec" and "init")

Examples:

`do on;load 0;delay 1;seq 0,3` 
Turn on all the oscillators, loads the first preset, waits for 1 second and finally plays the presets 0 to 3 in order.

`do repeat 10|+1|delay 0.5 ; repeat 10|+-1|delay 0.5 ; off`
Repeat 10 times an increment of 1 hz in the first oscillator, then repeat 10 times a decrement of 1 hz in the first oscillator and finally turn off the oscillators

### Execute command (exec)
To execute the content of a previously saved file.

- Format: _exec [fileName]_
- Being 
	- fileName: the full file name to execute (cannot contain spaces)

Example:
`exec /up-down`

### Init command (init)
To Set the initial commands to execute after turning on the device

- Format: _init cmd1;cmd2;..._
- Being:
	- cmdx: Any valid string command 

#### Set a sequencer from preset 0 to 3 as the initial command
`init seq 0,3,1,0`

#### Load the preset at index 0 and then play the song 1, twice
`init load 2;play 1,2`

### Debug

#### Enable debug mode via BLE 
`debug 1`

#### Disable debug mode via BLE 
`debug 0`

#### Switch debug mode
`debug`

### Refesh/Query status
Notify the BLE clients for the current frequencies and duties and prints the current frequencies and duties

Example:
`?` 

### Restart
Restart the hardware

Example:
`restart`

### Delay
Waits for the given time in seconds

Example:
`delay 10`
