# UUID

SVC UUID: ca000000-fede-fede-0000-000000000000
CMD/FREQ UUID: ca000000-fede-fede-0000-000000000001
DUTY UUID: ca000000-fede-fede-0000-000000000002

# Commands

## Frequencies

### Set the base frequency for oscillators in Hertz

Format: d[,d[,d[,d]]]

Being: d=decimal number 
	   > 0: frequency in Hertz
	   = 0: turn off the oscillator
	   < 0: no change in frequency

Examples:

- Sets the current oscillator frequencies to 99.5, 440, 45, and 72 Hz respectively:
`99.5,440,45,72`

- Sets the OSC 1 frequency to 98.7 Hz:
`98.7`

- Sets the OSC 2 frequency to 100 Hz, but leave the others with the current frequency:
`-1,100`

same as:
`-1,100,-1,-1`

### Multipliers

Format: *d[,d[,d[,d]]]

Being: d=decimal number 
	   > 0: number to multiply the current frequency
	   = 0: turn off the oscillator
	   < 0: multiply the base frequency from config by ABS(d)

> The multiplication does not trigger the frequency values saving to the config file.

Examples:

- Multiply the current oscillator frequencies by 2, 0.5, 4 and 3 respectively:
`*2,.5,4,3`

- Multiply the frequency of OSC 1 by 0.125:
`*0.125`

- Set the frequency of OSC 1 to the last written config value multiplied by 2.5:
`*-2.5`

### Increments

Format: +d[,d[,d[,d]]]

Being: d=decimal number 
	   > 0: increment the frequency in d hertz
	   = 0: no imcrement
	   < 0: decrement the frequency in -d hertz
	   
> The incrementation does not trigger the frequency values saving to the config file.

Examples:

- Increment the current oscillator frequencies by 100, -50, 20 and 30 Hertz respectively:
`+100,-50,20,30`

- Decrement the  oscillator frequency of OSC 1 by 100 Hertz:
`+-100`

## Duties

Format: /d[,d[,d[,d]]]

Being: d=decimal number 
	   > 0: duty for the oscillator (1-1023)
	   = 0: turn off the oscillator (0% duty)
	   < 0: no change in duty

Examples:

- Set the duties to 512 for all the oscillators:
`/512,512,512,512`

- Set the duty for OSC 1 to 900:
`/900`

- Set the duty for OSC 1 to 900 and OSC 4 to 400:
`/900,-1,-1,400`


## Generic commands

#### Reset
Will reset the frequency and duty values to their config file value

Example:
`reset`

### Songs

#### Play a song

Format: play SongIndex[,Iterations[,Speed[,Variation]]]
Being: SongIndex=The song index to play
	   Iterations=Times to repeat the song (default is 1)
	   Speed=(optional) Speed to play at (1 is normal speed, 2 is double speed, 0.5 is half speed) (default is 1)
	   Variation=(optional) number 
			> 0: randomize the steps order with the given number as seed. 
			= 0: pseudo randomize steps
			< 0: no randomizing (default)

Examples:

- Play the song at index 0, no repetition, at normal speed
`play 0`

- Play the song at index 1, repeat 10 times, at 5x speed
`play 1,10,5`

- Play the song at index 1, repeat 20 times, at 4x speed, with pseudo-random steps order
`play 1,20,4,0`

- Play the song at index 0, Repeat 2 times, at 1.5x speed, using a randomization for the steps with seed = 5
`play 0,2,1.5,5`


