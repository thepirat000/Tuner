/****** By ThePirat 2021 ***** 

Docs/Links:
- MIDI: https://webaudio.github.io/web-midi-api/#midimessageevent-interface
*/

let characteristicCmd;
let characteristicDuties;
let characteristicFreqs;
let characteristicPreset;
let device;
const encoder = new TextEncoder('utf-8');
let lastFreqFromMic = 0.0;
let oscCount = 4;
let presetCount = 8;
let keyboardListening = true;
let sustain = false;

$(document).ready(function () {
	StartMidi();
	$('.lcs_check').lc_switch('ON', 'OFF');

	LoadAndSetupConfig();
	SetupSlider();

	$("#btn-restart").click(async function(e) {
		await Restart();
	});

	$("#btn-scan").click(async function(e) {
		if ($(this).text() == "Disconnect") {
			await Disconnect();
		}
		else {
			await Scan();
		}
	});
	
	$("#btn-play-song").click(async function(e) {
		await PlaySong();
	});

	$("#btn-play-seq").click(async function(e) {
		await PlaySequence();
	});

	$(".navbar a").click(function (e) {
		NavBarClick($(this).attr('data-value'));
	});

	$("#btn-load").click(async function(e) {
		await Load();
	});
	$("#btn-save").click(async function(e) {
		await Save();
	});
	$("#btn-play").click(async function(e) {
		await Play();
	});
	$(".stop-button").click(async function(e) {
		await Stop();
	});
	$("#btn-clear").click(function(e) {
		Clear();
	});
	$("#debug").change(async function(e) {
		let cmd = "debug " + (this.checked ? "1" : "0");
		await SendCommand(cmd);
	});
	$("input[name=preset]").dblclick(async function(e) {
		await Load();
	});
	$('#command').bind('keypress', async function (e) {
		if(e.which == 13) {
			await SendConsoleCommand();
		}
	});

	$('#oscillators').on("change", ".freq-div .slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await SendFreqUpdate(osc, parseFloat(this.value));
	});
	$('#oscillators').on("input", ".freq-div .slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		SetFreqText(osc, parseFloat(this.value));
	});

	$('#oscillators').on("change", ".duty-div .slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await SendDutyUpdate(osc, parseFloat(this.value));
	});	
	$('#oscillators').on("input", ".duty-div .slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		SetDutyText(osc, parseFloat(this.value));
	});

	$('#oscillators').on("click", ".freq-div .freq,.freq-div .note", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await ChangeFreqManual(osc, $(this).text());
	});	
	
	$('#oscillators').on("click", ".duty-div .duty-text", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await ChangeDutyManual(osc, $(this).text());
	});

	$('#oscillators').on("click", ".incr-config .step-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await HandleFreqStepButton(osc, $(this).attr('data-op'));
	});	

	$('#oscillators').on("click", ".mult-config .mult-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await HandleMultButton(osc, $(this).attr('data-mult'));
	});	
	
	$('#oscillators').on("lcs-statuschange", ".lcs_check", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		let status = ($(this).is(':checked')) ? 'on' : 'off';
		await HandleTurnOffOn(osc, status);
	});	

	$('#oscillators').on("click", ".set-duty-buttons .step-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await SendDutyUpdate(osc, parseFloat(this.attributes["data-value"].value));
	});
	
	$('#oscillators').on("change", ".id-div input[name=mic]", function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		HandleMicCheck(osc, this.checked);
	});	

	$('#oscillators').on("change", ".id-div input[name=solo]", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		HandleSoloCheck(osc, this.checked);
	});	
});

function NavBarClick(target) {
	switch(target)
	{
		case "presets":
			$(".top-config").hide();
			$("#console").show();
			ShowOscillators();
			$(".main-container>div").not(".top-buttons").hide();
			break;
		case "songs":
			$(".top-songs").show();
			$("#console").show();
			ShowOscillators();
			$(".main-container>div").not(".top-songs").hide();
			break;
		case "sequence":
			$(".top-sequence").show();
			$("#console").show();
			ShowOscillators();
			$(".main-container>div").not(".top-sequence").hide();
			break;
		case "settings":
			HideOscillators();
			$(".main-container>div").not(".top-config").hide();
			$(".top-config").show();
			$("#console").hide();
			break;
	}
	$(".navbar a").removeClass('active');
	$(".navbar a[data-value='" + target + "']").addClass('active');
}

function LoadAndSetupConfig() {
	// Load values
	if (localStorage.getItem('dark') == 'true') {
		$("#dark").prop('checked', true);
		$('body').addClass('dark-mode');
	}	
	let slidersEnabled = localStorage.getItem('sliders-enabled') == 'true';
	$("#sliders-config").prop('checked', slidersEnabled);
	$("#freqRange").prop('disabled', !slidersEnabled);
	$(".slider").toggle(slidersEnabled);

	$("#oscCount").val(localStorage.getItem('osc-count') ?? 4);
	GenerateOscillatorsUI();

	$("#freqRange").val(localStorage.getItem('freq-range') ?? 2000);

	// Setup
	$("#dark").click(function() {
		localStorage.setItem('dark', this.checked);
		if (this.checked) {
			$('body').addClass('dark-mode');
		} 
		else {
			$('body').removeClass('dark-mode');
		}
	});
	$("#sliders-config").change(function(e) {
		localStorage.setItem('sliders-enabled', this.checked);
		$("#freqRange").prop('disabled', !this.checked);
		$(".slider").toggle(this.checked);
	});
	$("#fullscreen").change(function(e) {
		fullScreenRequest();
	});
	$("#oscCount").change(function() {
		localStorage.setItem('osc-count', this.value);
		GenerateOscillatorsUI();
	});	
	$("#freqRange").change(function() {
		localStorage.setItem('freq-range', this.value);
	});	
}

function SetupSlider() {
	var slider = document.getElementById('seq-range');

	noUiSlider.create(slider, {
		start: [1, 8],
		connect: true,
		step: 1,
		range: {
			'min': 1,
			'max': 8			
		},
		tooltips: [wNumb({decimals: 0}), wNumb({decimals: 0})]
		
	});
}

async function Scan() {
	$("#console").show();
	AppendLogLine("Scanning...");
	try {
		device = await navigator.bluetooth.requestDevice({
			filters: [{
				namePrefix: 'Tuner'
			}],
			optionalServices: ['fe000000-fede-fede-0000-000000000000']});
	} catch(err) {
		AppendLogLine("Error: " + err);
		HideOscillators();
		$(".top-config").show();
		return false;
	}
	ShowWaitCursor();
	device.addEventListener('gattserverdisconnected', onDisconnected);
	await connectDeviceAndCacheCharacteristics();
	NavBarClick("presets");
	await SendCommand("?");
	HideWaitCursor();

	return true;
}

function ShowCnnStatus(status) {
	switch(status)
	{
		case "connected":
			$("#title").text("Connected to: " + device.name)
			AppendLogLine("Connected to " + device.name);
			$("#btn-scan").text("Disconnect");
			break;
		case "connecting":
			$("#title").text("Connecting...");
			AppendLogLine("Connecting to " + device.name);
			break;
		case "disconnected":
			$("#title").text("Not connected");
			AppendLogLine("Disconnected");
			$("#btn-scan").text("Connect");
			break;
	}
}

function ShowOscillators() {
	$("#btn-reconnect").show();
	$(".top-buttons").show();
	$("#command-div").show();
	$("#oscillators").show();
}

function HideOscillators() {
	$("#btn-reconnect").hide();
	$(".top-buttons").hide();
	$("#command-div").hide();
	$("#oscillators").hide();
}

async function Disconnect() {
	if (device && device.gatt.connected) {
		ShowCnnStatus("disconnected");
		device.removeEventListener('gattserverdisconnected', onDisconnected);
		await device.gatt.disconnect();
	}
}

async function GetFreqs() {
	let valueFreq =	new TextDecoder().decode(await characteristicCmd.readValue());
	return valueFreq;
}

async function GetDuties() {
	let valueDuties = new TextDecoder().decode(await characteristicDuties.readValue());
	return valueDuties;
}

async function onDisconnected() {
	ShowWaitCursor();
	ShowCnnStatus("disconnected");
	await connectDeviceAndCacheCharacteristics();
	HideWaitCursor();
	await SendCommand("?");
}

async function connectDeviceAndCacheCharacteristics() {
	if (device.gatt.connected && characteristicCmd) {
		return;
	}
	try {
		ShowCnnStatus("connecting");
		const server = await device.gatt.connect();
		const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
		characteristicFreqs = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
		characteristicFreqs.addEventListener('characteristicvaluechanged', handleFreqValueChange);
		await characteristicFreqs.startNotifications();
		characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
		characteristicDuties.addEventListener('characteristicvaluechanged', handleDutyValueChange);
		await characteristicDuties.startNotifications();
		characteristicSwitches = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000003'))[0];
		characteristicSwitches.addEventListener('characteristicvaluechanged', handleSwitchesValueChange);
		await characteristicSwitches.startNotifications();
		characteristicPreset = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000004'))[0];
		characteristicPreset.addEventListener('characteristicvaluechanged', handlePresetChange);
		await characteristicPreset.startNotifications();
		characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000099'))[0];
		characteristicCmd.addEventListener('characteristicvaluechanged', handleCmdValueChange);
		await characteristicCmd.startNotifications();
		ShowCnnStatus("connected");
		// send the debug 1 command if needed
		if ($("#debug").is(':checked')) {
			await SendCommand("debug 1");
		}
	}
	catch (err) {
		ShowCnnStatus("disconnected");
		HideWaitCursor();
		NavBarClick("settings");
		alert(err);
	}
}

function handleFreqValueChange(event) {
	for (let i = 0; i*2 < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint16(i*2);
		ShowFreqValue(i+1, value);
	}
}

function handleDutyValueChange(event) {
	for (let i = 0; i*2 < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint16(i*2);
		ShowDutyValue(i+1, value);
	}
}

function handleSwitchesValueChange(event) {
	for (let i = 0; i < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint8(i);
		ShowSwitchValue(i+1, value);
	}
	checkSolo();
}

function checkSolo() {
	let turnedOn = $(".oscillator .lcs_on").length;
	$("#oscillators input[name=solo]").prop('checked', false);
	if (turnedOn == 1) {
		$(".lcs_wrap .lcs_on").parents('.oscillator').attr('id')
		$(".lcs_wrap .lcs_on").parents('.oscillator').find('input[name=solo]').prop('checked', true);
	}
}

function handlePresetChange(event) {
	if (event.target.value.byteLength > 0) {
		let pindex = event.target.value.getUint8(0);
		$("#preset" + (pindex + 1)).prop('checked', true);
	}
}

function handleCmdValueChange(event) {
	let value  = new TextDecoder().decode(event.target.value);
	if (value[value.length-1] == "\n") {
		value = value.replace("\n", "&#13;&#10;");
	}
	AppendLog(value);
}

function AppendLog(value) {
	let cmdOut = $('#command-output');
	cmdOut.append(value); 
	cmdOut.scrollTop(cmdOut[0].scrollHeight - cmdOut.height());
}

function AppendLogLine(value) {
	AppendLog(value + "\n");
}

function Clear() {
	$("#command-output").empty();
}

function GenerateOscillatorsUI() {
	$(".oscillator:not(:first)").remove();
	oscCount = $("#oscCount").val();
	for (let i = 2; i <= oscCount; ++i) {
		let clone = $("#osc-1").clone();
		clone.attr("id", clone.attr("id").substring(0, clone.attr("id").length - 1) + i);
		clone.find('[id]').each(function () { 
			if (this.id.endsWith("-1")) {
				this.id = this.id.substring(0, this.id.length - 1) + i;
			}
		});
		clone.find('[for]').each(function () { 
			if (this.htmlFor.endsWith("-1")) {
				this.htmlFor = this.htmlFor.substring(0, this.htmlFor.length - 1) + i;
			}
		});		
		$(clone).find("#osc-id-" + i).text(i);
		$("#oscillators").append(clone);
	}

	let maxRange = $("#freqRange").val();
	$(".freq-div .slider").prop('max', maxRange);
}

async function SendConsoleCommand() {
	let cmd = $("#command").val();
	let ok = await SendCommand(cmd);
	if (ok) {
		$("#command").val("");
	}
}

function ShowFreqValue(osc, value) {
	let prevValue = $("#slider-freq-" + osc).attr("data-prev-value");
	$("#freq-" + osc).css('color', 'var(--freq-color)');
	if (prevValue != value) {
		let freq = parseInt(value);
		$("#freq-" + osc).text(freq);
		$("#freq-note-" + osc).text(FreqToNoteName(freq));
		SetSliderFreqValue(osc, value)
		$("#freq-div-" + osc).stop(true,true);
		$("#freq-div-" + osc).effect('highlight',{},500); 
	}
}
// value: 0-1023
function ShowDutyValue(osc, value) {
	let percentage = value * 100 / 1023;
	let prevValue = $("#slider-duty-" + osc).attr("data-prev-value");
	$("#duty-text-" + osc).css('color', 'var(--duty-color)');
	if (prevValue != percentage) {
		$("#duty-text-" + osc).text(parseFloat(percentage).toFixed(0));
		SetSliderDutyValue(osc, percentage);
		$("#duty-div-" + osc).stop(true,true);
		$("#duty-div-" + osc).effect('highlight',{},500); 
	}
}

function SetSliderFreqValue(osc, freq) {
	$("#slider-freq-" + osc).val(freq);
	$("#slider-freq-" + osc).attr("data-prev-value", freq);
}

function SetSliderDutyValue(osc, duty) {
	$("#slider-duty-" + osc).val(duty);
	$("#slider-duty-" + osc).attr("data-prev-value", duty);
}

function ShowSwitchValue(osc, value) {
	// Change the switch values without triggering the onchange
	let oscSwitch = $("#osc-" + osc + " .lcs_wrap .lcs_switch")
	if (value) {
		oscSwitch.removeClass('lcs_off').addClass('lcs_on');
	} 
	else {
		oscSwitch.removeClass('lcs_on').addClass('lcs_off');
	}
}

async function SendCommand(cmd, retries = 0, wait = 0) {
	if (cmd) {
		AppendLogLine("> " + cmd);
		let value = encoder.encode(cmd);
		try {
			await characteristicCmd.writeValue(value);
		} catch (ex) { 
			if (ex.message.indexOf("GATT operation already in progress") >= 0) {
				if (retries-- > 0) {
					console.log("Will Retry GATT operation! " + retries);
					await sleep(wait);
					return await SendCommand(cmd, retries, wait * 2);
				}
			}
			return false; 
		}
		return true;
	}
}

function SetFreqText(osc, value) {
	// User is sliding the freq slider, show a visual feedback
	let freq = parseInt(value);
	$("#freq-" + osc).text(freq).css('color', 'var(--running-freq-color)');
	$("#freq-note-" + osc).text(FreqToNoteName(freq));
}

function FreqToNoteName(freq) {
	if (freq > 0) {
		let note = new Note();
		note.setFrequency(freq);
		if (note.name) {
			let notes = note.name.split('/');
			if (notes.length > 1) {
				if (notes[1][0] == 'E' || notes[1][0] == 'B') {
					// Use bemol
					return notes[1];
				}
				return notes[0];
			}
			return notes[0];
		}
	}
	return "N/A";
}

function SetDutyText(osc, value) {
	// User is sliding the duty slider, show a visual feedback
	$("#duty-text-" + osc).text(parseInt(value)).css('color', 'var(--running-duty-color)');
}

async function SendFreqUpdate(osc, value) {
	// User finished sliding freq slider
	if (value < 0) {
		value = 0;
	}
	if (value > 40000) {
		value = 40000;
	}
	let msg = "";
	for(let i = 1; i < osc; ++i) {
		msg += ",";
	}
	msg += value;
	return await SendCommand(msg);
}

async function SendDutyUpdate(osc, value) {
	let duty = value >= 100 ? 1023 : parseInt(value * 1024 / 100);
	let msg = "/";
	
	if ($("#lock-duty-" + osc + ":checked").length) {
		// locked
		for(let i = 1; i <= oscCount; ++i) {
			msg += ($("#lock-duty-" + i + ":checked").length ? duty : "") + ",";
		}
		msg = msg.substring(0, msg.length - 1);
	}
	else {
		for(let i = 1; i < osc; ++i) {
			msg += ",";
		}
		msg += duty;
	}
	return await SendCommand(msg);
}

async function Save() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	let ok = await SendCommand("save " + pindex);
	if (ok) {
		$("#btn-save").stop(true,true);
		$("#btn-save").effect('highlight',{},500); 
		AppendLogLine("Saved P" + (pindex+1));
	}
}
async function Load() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	let ok = await SendCommand("load " + pindex);
	if (ok) {
		$("#btn-load").stop(true,true);
		$("#btn-load").effect('highlight',{},500); 
		AppendLogLine("Loaded P" + (pindex+1));
	}
}

function ShowWaitCursor() {
	document.documentElement.style.cursor = 'wait';
	$("input").css("cursor", "progress");
}
function HideWaitCursor() {
	document.documentElement.style.cursor = 'default';
	$("input").css("cursor", "default");
}

async function ChangeFreqManual(osc, currValue) {
	let input = prompt("Enter the new frequency (in Hertz or note name) for OSC " + osc, currValue);
	if (input) {
		let freq = parseInt(input);
		if (!isNaN(freq)) {
			// Freq is a number in hertz
			if (freq >= 0) {
				await SendFreqUpdate(osc, freq);
				SetFreqText(osc, freq);
				resetConfigButtons(osc);
			}
		} else {
			// Freq is not a number, assuming it is a note
			let note = new Note();
			note.setName(input);
			freq = parseInt(note.frequency);
			await SendFreqUpdate(osc, freq);
			SetFreqText(osc, freq);
			resetConfigButtons(osc);
		}
	}
}

function resetConfigButtons(osc) {
	$(".osc-config input[type=checkbox][id$=" + osc + "]:checked").attr('checked', false);
}

async function ChangeDutyManual(osc, currValue) {
	currValue = parseInt(currValue.trim());
	let input = prompt("Enter the new duty cycle (0-100) for OSC " + osc, currValue);
	if (input) {
		let duty = parseInt(input);
		if (!isNaN(duty)) {
			if (duty < 0) {
				duty = 0;
			} else if(duty > 100) {
				duty = 100;
			}
			await SendDutyUpdate(osc, duty);
			SetDutyText(osc, duty);
		}
	}
}

async function HandleFreqStepButton(osc, op) {
	let operand = parseFloat($("#incr-freq-step-" + osc).val());
	if (operand > 0) {
		operand = op == '-' ? (operand * -1) : operand;
		let msg = "+";
		for(let i = 1; i < osc; ++i) {
			msg += ",";
		}
		msg += operand;
		await SendCommand(msg);
	}
}

async function HandleMultButton(osc, mult) {
	let msg = "*";
	for(let i = 1; i < osc; ++i) {
		msg += ",";
	}
	msg += mult;
	await SendCommand(msg);
}

async function HandleTurnOffOn(osc, status) {
	await SendCommand(status + " " + osc);
	checkSolo();
}

function StartMidi() {
	if (!navigator.requestMIDIAccess) {
		return;
	}
	navigator.requestMIDIAccess()
		.then(midi => {
			for (var input of midi.inputs.values()) {
				input.onmidimessage = OnMIDIMessage;
			}
		});
}

async function OnMIDIMessage(message) {
	// Process the MIDI-FREQ tuning input
	let handled = await ProcessMidiTuningEvent(message.data);

	if (handled) {
		return;
	}

	// Process MIDI event -> Command mapping
	let cmd = GetCommandForMidiEvent(message.data);
	if (cmd) {
		await SendCommand(cmd, 4, 100);
	}
}

// Returns the message to send via bluetooth when a MIDI event is received
function GetCommandForMidiEvent(data) {
	let isNoteOn = (data[0] & 0xf0) == 0x90 && data[2] != 0;
	let isNoteOff = ((data[0] & 0xf0) == 0x80) || ((data[0] & 0xf0) == 0x90 && data[2] == 0);
	let noteName = (isNoteOn || isNoteOff) ? FreqToNoteName(MidiNoteToFreq(data[1])) : "N/A";
	let noteAsOsc = { "C4": 1, "D4": 2, "E4": 3, "F4": 4 };

	if (noteAsOsc.hasOwnProperty(noteName)) {
		let osc = noteAsOsc[noteName];
		if (isNoteOn) {
			let noteVelocity = isNoteOn ? data[2] : 0;
			let duty = noteVelocity <= 90 ? Math.round(512 / 90 * noteVelocity) + 1 : Math.round(767 / 127 * noteVelocity);
			let dutyStr = ["/n", "/,n", "/,,n", "/,,,n"][osc-1].replace("n", duty)
			return "Repeat 1|On " + osc + "|" + dutyStr;
		} else {
			return "Off " + osc;
		}
	}
	return null;
}

async function ProcessMidiTuningEvent(data) {
	let checked = $("input[name=midi]:checked");
	if (checked.length == 0) {
		return false;
	}	

	let handled = false;
    var command = data[0];
    var note = data[1];
    var velocity = (data.length > 2) ? data[2] : 0; // a velocity value might not be included with a noteOff command
	for(let input of checked) {
		let osc = input.id.substring(input.id.length - 1);
		switch (command & 0xf0) {
			case 0x90:
				// Note on with velocity
				if (velocity > 0) {
					await noteOn(note, velocity, osc, true);
				} else {
					await noteOff(note, osc, true);
				}
				handled = true;
				break;
			case 0x80:
				// Note off
				await noteOff(note, osc, true);
				handled = true;
				break;
			case 0xB0:
				// Sustain
				sustain = (velocity > 0);
				break;

		}
	}
	
	return handled;
}

async function noteOn(note, velocity, osc) {
	let duty = velocityToDuty(velocity);
	if (duty > 0) {
		let freq = MidiNoteToFreq(note);
		SetFreqText(osc, freq);
		SetDutyText(osc, duty);
		SetSliderFreqValue(osc, freq)
		SetSliderDutyValue(osc, duty)
		await SendFreqUpdate(osc, freq);
		await sleep(10);
		await SendDutyUpdate(osc, duty);
	}
	if (!sustain) {
		await SendDutyUpdate(osc, duty);
	}
}

async function noteOff(note, osc) {
	if (!sustain) {
		SetDutyText(osc, 0);
		await SendDutyUpdate(osc, 0);
	}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function MidiNoteToFreq(midiNote) {
    let a = 440;
    return (a / 32) * (2 ** ((midiNote - 9) / 12));
}

function velocityToDuty(velocity) {
	// 0 -> 0%
	// 1-127 => 15%-85% (255-767)
	if (velocity <= 0) {
		return 0;
	}
	return ((velocity*70/127)+15).toFixed(0);
}

let sameFreqCount = 0;

function HandleMicCheck(osc, checked) {
	if (PitchDetect.AudioContext == null && checked) {
		// Turn on Mic
		PitchDetect.MinTimeBetweenUpdates = 200;
		sameFreqCount = 0;
		PitchDetect.Init();
		PitchDetect.StartLiveInput(async (current, lastKnown) => await callbackPitchDetect(current, lastKnown));
	}
	else if (PitchDetect.AudioContext != null && $("input[name=mic]:checked").length == 0) {
		// Turn off Mic
		PitchDetect.StopLiveInput();
		PitchDetect.AudioContext = null;
	}
}

async function HandleSoloCheck(osc, checked) {
	if (checked) {
		$("#oscillators input[name=solo]").prop('checked', false);
		$("#solo-osc-" + osc).prop('checked', true);
		await SendCommand("solo " + osc);
	} else {
		await SendCommand("on");
	}
}

async function callbackPitchDetect(current, lastKnown) {
	let freq = Math.round(lastKnown);
	
	if (freq > 0 && lastFreqFromMic != freq) {
		sameFreqCount = 0;
		lastFreqFromMic = freq;
		for(let micCheck of $("input[name=mic]:checked")) {
			let osc = parseInt(micCheck.id[micCheck.id.length - 1]);
			SetSliderFreqValue(osc, freq)
			SetFreqText(osc, freq);
			SendFreqUpdate(osc, freq);
		}
	}
	current = Math.round(current);
	if (current > 0 && lastFreqFromMic == current) {
		sameFreqCount++;
	} 
	if (sameFreqCount >= 4) {
		// Stop
		$("input[name=mic]:checked").prop('checked', false);
		PitchDetect.StopLiveInput();
		PitchDetect.AudioContext = null;
	}
}

async function Play() {
	let input = prompt("Time to wait between steps (in Seconds)", 1);
	if (input) {
		let wait = parseFloat(input);
		if (!isNaN(wait) && wait > 0) {
			await SendCommand("seq 0," + (presetCount - 1) + "," + input);
		}
	}
}

async function Stop() {
	await SendCommand("stop");
}

async function Restart() {
	await SendCommand("restart");
}
	
function fullScreenRequest() {
	try {
		if ($("#fullscreen").prop('checked')) {
			document.documentElement.requestFullscreen();
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			}
		}
	} catch (error) {
		console.log(error);
	}
}

async function PlaySong() {
	let songIndex = $("#song-index").val();
	let songTimes = $("#song-times").val() ? $("#song-times").val() : 1;
	let songSpeed = $("#song-speed").val() ? $("#song-speed").val() : 1;
	let songVariation = $("#song-variation").val() ? $("#song-variation").val() : -1;
	if (songIndex) {
		// play SongIndex[,Iterations[,Speed[,Variation]]]
		let cmd = "play " + songIndex + "," + songTimes + "," + songSpeed + "," + songVariation;
		await SendCommand(cmd);
	}
}

async function PlaySequence() {
	let slider = document.getElementById('seq-range');
	let range = slider.noUiSlider.get();
	let seqTimes = $("#seq-times").val() ? $("#seq-times").val() : 0;
	let seqDelay = $("#seq-delay").val() ? $("#seq-delay").val() : 1;
	let seqVariation = $("#seq-variation").val() ? $("#seq-variation").val() : -1;
	if (range) {
		// seq [StartIndex[,EndIndex[,Interval[,Iterations[,Variation]]]]]
		let cmd = "seq " + Math.round(range[0]-1) + "," + Math.round(range[1]-1) + "," + seqDelay + "," + seqTimes + "," + seqVariation;
		await SendCommand(cmd);
	}
}

// Keyboard processing
document.addEventListener('keydown', async (e)=> {
	if (keyboardListening && !e.repeat && !$(e.target).is("input")) {
		let cmd = GetCommandForKeyboardEvent(e, true);
		if (cmd) {
			e.preventDefault();
			await SendCommand(cmd, 4, 100);
		}
	}
});
	
document.addEventListener('keyup', async (e) => {    
	if (keyboardListening && !$(e.target).is("input")) {
		let cmd = GetCommandForKeyboardEvent(e, false);
		if (cmd) {
			e.preventDefault();
			await SendCommand(cmd, 4, 100);
		}
	}
});

function GetCommandForKeyboardEvent(data, isKeyDown) {
	let keyAsOsc = { "1": 1, "2": 2, "3": 3, "4": 4 };

	if (keyAsOsc.hasOwnProperty(data.key)) {
		let osc = keyAsOsc[data.key];

		if (data.altKey) {
			// SOLO
			if (isKeyDown) {
				return "solo " + osc;
			}
		} else if (data.ctrlKey || data.metaKey) {
			// TOGGLE
			if (isKeyDown) {
				let turnedOn = $("#osc-" + osc + " .lcs_on").length > 0;
				return (turnedOn ? "off " : "on ") + osc;
			}
		}
		else {
			// ON/OFF
			return (isKeyDown ? "on " : "off ") + osc;
		}
	}

	return null;
}
