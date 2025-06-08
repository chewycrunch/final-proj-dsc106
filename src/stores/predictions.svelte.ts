const predictions = $state({
	avgICUStay: 0,
	mortalityRate: 0,
	avgBloodLoss: 0,
	icuIQR: { q1: 0, q3: 0 },
	bloodLossIQR: { q1: 0, q3: 0 }
});

let predictionsDisabled = $state({
	status: false,
	reason: ''
});

export const usePredictions = () => {
	return predictions;
};

export const resetPredictions = () => {
	predictions.avgICUStay = 0;
	predictions.mortalityRate = 0;
	predictions.avgBloodLoss = 0;
	predictions.icuIQR = { q1: 0, q3: 0 };
	predictions.bloodLossIQR = { q1: 0, q3: 0 };
};

export const setPredictions = (newPredictions: typeof predictions) => {
	predictions.avgICUStay = newPredictions.avgICUStay;
	predictions.mortalityRate = newPredictions.mortalityRate;
	predictions.avgBloodLoss = newPredictions.avgBloodLoss;
	predictions.icuIQR = newPredictions.icuIQR;
	predictions.bloodLossIQR = newPredictions.bloodLossIQR;
};

export const predictionsWereMade = () => {
	return (
		predictions.avgICUStay > 0 ||
		predictions.mortalityRate > 0 ||
		predictions.avgBloodLoss > 0 ||
		predictions.icuIQR.q1 > 0 ||
		predictions.icuIQR.q3 > 0 ||
		predictions.bloodLossIQR.q1 > 0 ||
		predictions.bloodLossIQR.q3 > 0
	);
};

export const usePredictionsDisabled = () => {
	return predictionsDisabled;
};

export const setPredictionsDisabled = (disabled: boolean, reason?: string) => {
	predictionsDisabled = {
		status: disabled,
		reason: reason || ''
	};
};
