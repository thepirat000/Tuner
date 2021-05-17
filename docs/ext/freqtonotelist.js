/*------------------------------------------------------------------------
# Frequency to Note List - Version 1.0
# ------------------------------------------------------------------------
# Copyright (C) Michael Norris. All Rights Reserved.
# @license - Copyrighted Commercial Software
# Author: Michael Norris
# Websites:  http://www.michaelnorris.info
# This file may not be redistributed in whole or significant part.
-------------------------------------------------------------------------*/

var debugOn=false;
var notes=new Array ('C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B');
var semitone = 1.0594630944;
var logsemitone = Math.log(semitone);
var cent = Math.pow(semitone,0.01);
var logcent = Math.log(cent);
var octzero = 16.35159783;

function debug(debugPoint) {
	if (debugOn) {
		alert(debugPoint);
	}
}

function reduce(numerator,denominator){
  var gcd = function gcd(a,b){
    return b ? gcd(b, a%b) : a;
  };
  gcd = gcd(numerator,denominator);
  return [numerator/gcd, denominator/gcd];
}

function roundTo3dp(n) {
	var s = "" + Math.round(n * 1000) / 1000;
	var i = s.indexOf('.');
	if (i<0) return s;
	var t = s.substring(0, i + 1) + s.substring(i + 1, i + 4);
	return t;
}

function freqToData (f) {
	var octave, n, octstart, notenum;
	octave = Math.floor(Math.log(f/octzero)/Math.log(2));
	octstart = octzero*Math.pow(2,octave);
	centstooctstart = Math.log(f/octstart)/logcent;
	sttooctstart = Math.round(centstooctstart/100);
	
	if (sttooctstart == 12) {
		octave ++;
		octstart = octzero*Math.pow(2,octave);
		centstooctstart = Math.log(f/octstart)/logcent;
		sttooctstart = 0;
	}
	notenum = sttooctstart;
	freqn = octstart*Math.pow(semitone,notenum);
	centsDetuned = Math.round(Math.log(f/freqn)/logcent);
	// ** GET THE MICROTONAL DEVIATION INDICATOR ** //
		microtonalDeviation = '';
		var quantizedCents = 50;
		var quantizedCentsThresh = quantizedCents/2;
		if (centsDetuned > quantizedCentsThresh || centsDetuned < -quantizedCentsThresh) {
			microtonalDeviation = Math.round(centsDetuned/quantizedCents);
			var numerator = microtonalDeviation;
			var denominator = 4;
			var fraction = reduce(numerator,denominator);
			if (microtonalDeviation > 0) {
				microtonalDeviation = '+'+fraction[0]+'/'+fraction[1];
			} else {
				microtonalDeviation = '-'+fraction[0]+'/'+Math.abs(fraction[1]);
			}
		}
	return notes[notenum]+"\t"+octave+"\t"+centsDetuned+"\t"+microtonalDeviation+"\n";
}

function getnname (i) {
	if (i==12) i=0;
	return notes[i];
}

function getnfreq (i) {
	if (i==12) i=0;
	return octzero*Math.pow(semitone,i);
}

function calculate() {
	var theFreqsStr,theFreqs,out,i;
	theFreqsStr = document.getElementsByName("input")[0].value;
	debug(theFreqsStr);
	out = document.getElementsByName("output")[0];
	out.value = "Note name\tOctave\t¢ dev. from 12TET\tMicrotone\n"
	theFreqs = theFreqsStr.split("\n");
	debug(theFreqs[0]);
	for (i = 0; i<theFreqs.length;i++) {
		freq = theFreqs[i];
		if (freq != "") {
			theStr = freqToData(freq);
			debug(theStr);
			out.value += theStr;
		}
	}
	return false;
}