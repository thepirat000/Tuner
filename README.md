# UUID

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

### Multipliers

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

### Increments

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

## Duties

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


## Generic commands

### Switch oscillators

#### Turn off 
Turn off an oscillator
- Format: _off [n]_
- Being 
	- n > 0: the oscillator number to turn off
	- n missing: turn off all the oscillators (default)

Example:
`off 1`

Will turn off the first oscillator

#### Turn on
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

#### Play a song

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
				- =: Repeat the step #operand (first step is 1, etc)
				- NULL: If no StepType is specified, the DefaultStepType is used

### Sample Song:
`mF440,520:1:512,512|2,1.5:1|f460,540:2|a1,1:1|=4|A10:1`

- Description

	- Default step type is "m" (multiply the current frequency)
		- 1st step: Set the first two oscillators base frequencies to 440 and 520 hz respectively, set the first two oscillator duties to 512, and wait 1 second
		- 2nd step: Multiply the first two oscillators current frequencies by 2 and 1.5 respectively, and wait 1 second
		- 3rd step: Set the first two oscillators current frequencies to 460 and 540 hz respectively, and wait 2 seconds
		- 4th step: Increment the first two oscillators current frequencies by 1, and wait 1 second
		- 5th step: Repeat the 4th step
		- 6th step: Set the first oscillator value as the base frequency + 10 hz, and wait 1 second

#### Stop playing a song
Will stop playing the current song (only available via Bluetooth)

Example:
`stop`

### Play presets sequence

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


#### Stop playing presets loop
Will stop playing the preset loop (only available via Bluetooth)

Example:
`stop`

### Init command
To Set the initial commands to execute after turning on the device

- Format: _init cmd1|cmd2|..._
- Being:
	- cmdx: Any valid string command 

#### Set a sequencer from preset 0 to 3 as the initial command
`init seq 0,3,1,0`

#### Load the preset at index 0 and then play the song 1, twice
`init load 2|play 1,2`

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
