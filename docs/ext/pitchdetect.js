/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* Modified version */

window.AudioContext = window.AudioContext || window.webkitAudioContext;

let PitchDetect = {};

PitchDetect.analyser = null;
PitchDetect.mediaStreamSource = null;
PitchDetect.rafID = null;
PitchDetect.buffer = new Float32Array( 2048 );
PitchDetect.lastUpdate = 0;

PitchDetect.CurrentPitch = -1;
PitchDetect.LastKnownPitch = -1;
PitchDetect.AudioContext = null;
PitchDetect.MinTimeBetweenUpdates = 150;

PitchDetect.Init = function() {
	PitchDetect.AudioContext = new AudioContext();
}

PitchDetect.GotStream = function (stream, callback_freq) {
    // Create an AudioNode from the stream.
    PitchDetect.mediaStreamSource = PitchDetect.AudioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    PitchDetect.analyser = PitchDetect.AudioContext.createAnalyser();
    PitchDetect.analyser.fftSize = 2048;
    PitchDetect.mediaStreamSource.connect(PitchDetect.analyser);
    PitchDetect.UpdatePitch(0, callback_freq);
}

PitchDetect.StartLiveInput = function (callback_freq) {
	PitchDetect.CurrentPitch = -1;
	PitchDetect.LastKnownPitch = -1;

    PitchDetect.GetUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, stream => PitchDetect.GotStream(stream, callback_freq));
}

PitchDetect.GetUserMedia = function (dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, function(err) { console.log(err); });
    } catch (e) {
        alert('GetUserMedia threw exception :' + e);
    }
}

PitchDetect.StopLiveInput = function() {
	if (PitchDetect.rafID) {
		if (!window.cancelAnimationFrame) {
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
		}
		window.cancelAnimationFrame(PitchDetect.rafID);
		
		PitchDetect.analyser = null;
		PitchDetect.AudioContext = null;
	}
}

PitchDetect.AutoCorrelate = function ( buffer, sampleRate ) {
	// Implements the ACF2+ algorithm
	let SIZE = buffer.length;
	let rms = 0;

	for (let i=0;i<SIZE;i++) {
		let val = buffer[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	let r1=0, r2=SIZE-1, thres=0.2;
	for (let i=0; i<SIZE/2; i++)
		if (Math.abs(buffer[i])<thres) { r1=i; break; }
	for (let i=1; i<SIZE/2; i++)
		if (Math.abs(buffer[SIZE-i])<thres) { r2=SIZE-i; break; }

	buffer = buffer.slice(r1,r2);
	SIZE = buffer.length;

	let c = new Array(SIZE).fill(0);
	for (let i=0; i<SIZE; i++)
		for (let j=0; j<SIZE-i; j++)
			c[i] = c[i] + buffer[j]*buffer[j+i];

	let d=0; while (c[d]>c[d+1]) d++;
	let maxval=-1, maxpos=-1;
	for (let i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	let T0 = maxpos;

	let x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}

PitchDetect.UpdatePitch = function (time, callback_freq) {
	const elapsed = time - PitchDetect.lastUpdate;
	
	if (PitchDetect.analyser != null && (time == 0 || elapsed > PitchDetect.MinTimeBetweenUpdates)) {
		let cycles = new Array;
		PitchDetect.analyser.getFloatTimeDomainData( PitchDetect.buffer );
		let ac = PitchDetect.AutoCorrelate( PitchDetect.buffer, PitchDetect.AudioContext.sampleRate );
		PitchDetect.CurrentPitch = ac;
		if (ac != -1) {
			PitchDetect.LastKnownPitch = ac;
		}
		if (callback_freq) {
			callback_freq(PitchDetect.CurrentPitch, PitchDetect.LastKnownPitch);
		}
		PitchDetect.lastUpdate = time;
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	PitchDetect.rafID = window.requestAnimationFrame(time => PitchDetect.UpdatePitch(time, callback_freq));
}