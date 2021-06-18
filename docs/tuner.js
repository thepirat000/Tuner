let characteristicCmd;
let characteristicDuties;
let characteristicFreqs;
let characteristicPreset;
let device;
const encoder = new TextEncoder('utf-8');
let lastFreqFromMic = 0.0;
let oscCount = 4;
let presetCount = 4;

$(document).ready(function () {
	$('.lcs_check').lc_switch();
	StartMidi();

	if (localStorage.getItem('dark') == 'true') {
		$("#dark").prop('checked', true);
		$('body').addClass('dark-mode');
	}
	$("#dark").click(function() {
		if (this.checked) {
			$('body').addClass('dark-mode');
			localStorage.setItem('dark', true);
		} 
		else {
			$('body').removeClass('dark-mode');
			localStorage.setItem('dark', false);
		}
	});

	$("#btn-restart").click(async function(e) {
		await Restart();
	});

	$("#btn-scan").click(async function(e) {
		await Scan();
	});
	$("#btn-test").click(async function(e) {
		ShowOscillators();
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
	$("#btn-stop").click(async function(e) {
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
	
	$('.oscillator').on("lcs-statuschange", ".lcs_check", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		let status = ($(this).is(':checked')) ? 'on' : 'off';
		await HandleTurnOffOn(osc, status);
	});	

	$('#oscillators').on("click", ".set-duty-buttons .step-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await SendDutyUpdate(osc, parseFloat(this.attributes["data-value"].value));
	});
	
	$('#oscillators').on("change", ".id-div input[name=mic]", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		HandleMicCheck(osc, this.checked);
	});	
});

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
		return;
	}
	$("#title").text(device.name);
	AppendLogLine("Connecting to '" + device.name + "'. Please wait...");
	ShowWaitCursor();
	device.addEventListener('gattserverdisconnected', onDisconnected);
	await connectDeviceAndCacheCharacteristics();
	SendCommand("?");
	ShowOscillators();
	HideWaitCursor();
}

function ShowOscillators() {
	GenerateOscillatorsUI();
	$("#div-config").hide();
	$("#btn-reconnect").show();
	$(".top-buttons").show();
	$("#command-div").show();
	$("#oscillators").show();
}

function HideOscillators() {
	$("#div-config").show();
	$("#btn-reconnect").hide();
	$(".top-buttons").hide();
	$("#command-div").hide();
	$("#oscillators").hide();
}

async function Disconnect() {
	if (device && device.gatt.connected) {
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
	AppendLogLine("Disconnected");
	await connectDeviceAndCacheCharacteristics();
	HideWaitCursor();
	SendCommand("?");
}

async function connectDeviceAndCacheCharacteristics() {
	if (device.gatt.connected && characteristicCmd) {
		return;
	}
	try {
		AppendLogLine("Connecting");
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
		AppendLogLine("Connected");
	}
	catch (err) {
		HideWaitCursor();
		HideOscillators();
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
	
	presetCount = $("#presetCount").val();
	$("#preset-group-2").toggle(presetCount > 4);
}

async function SendConsoleCommand() {
	let cmd = $("#command").val();
	AppendLogLine("> " + cmd);
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
		$("#freq-note-" + osc).text(GetNote(freq));
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

async function SendCommand(cmd) {
	if (cmd) {
		let value = encoder.encode(cmd);
		try {
			await characteristicCmd.writeValue(value);
		} catch { return false; }
		return true;
	}
}

function SetFreqText(osc, value) {
	// User is sliding the freq slider, show a visual feedback
	let freq = parseInt(value);
	$("#freq-" + osc).text(freq).css('color', 'var(--running-freq-color)');
	$("#freq-note-" + osc).text(GetNote(freq));
}

function GetNote(freq) {
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
	// User finished sliding duty slider
	let duty = value >= 100 ? 1023 : parseInt(value * 1024 / 100);
	let msg = "/";
	for(let i = 1; i < osc; ++i) {
		msg += ",";
	}
	msg += duty;
	return await SendCommand(msg);
}

async function Save() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	let ok = await SendCommand("save " + pindex);
	if (ok) {
		$("#btn-save").stop(true,true);
		$("#btn-save").effect('highlight',{},500); 
		AppendLogLine("Saved");
	}
}
async function Load() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	let ok = await SendCommand("load " + pindex);
	if (ok) {
		$("#btn-load").stop(true,true);
		$("#btn-load").effect('highlight',{},500); 
		AppendLogLine("Loaded");
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
}

function StartMidi() {
	if (!navigator.requestMIDIAccess) {
		return;
	}
	navigator.requestMIDIAccess()
		.then(midi => {
			for (var input of midi.inputs.values()) {
				input.onmidimessage = onMIDIMessage;
			}
		});
}

async function onMIDIMessage(message) {
	let checked = $("input[name=midi]:checked");
	if (checked.length == 0) {
		return;
	}
	
    var command = message.data[0];
    var note = message.data[1];
    var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

	for(let input of checked) {
		let osc = input.id.substring(input.id.length - 1);
		switch (command) {
			case 144: 
				if (velocity > 0) {
					await noteOn(note, velocity, osc, true);
				} else {
					await noteOff(note, osc, true);
				}
				break;
			case 128: 
				await noteOff(note, osc, true);
				break;
		}
	}		
}

async function noteOn(note, velocity, osc, sustain) {
	let duty = velocityToDuty(velocity);
	if (duty > 0) {
		let freq = noteToFreq(note);
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

async function noteOff(note, osc, sustain) {
	if (!sustain) {
		SetDutyText(osc, 0);
		await SendDutyUpdate(osc, 0);
	}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function noteToFreq(note) {
    let a = 440;
    return (a / 32) * (2 ** ((note - 9) / 12));
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
	HideOscillators();
	$("#console").hide();
}
	