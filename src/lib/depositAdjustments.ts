// Players whose 18 Oct Raw Iron deposits were re-credited at the net gold received ("Option B").
// Server-only: each player is sent their own entry with their session, never the whole list.
export interface RecalibratedInfo {
  inGameName: string;
  units: number;
  grossPaid: number;
  taxDeducted: number;
  netReceived: number;
  initialCredited: number;
  adjustmentCredit: number;
}

export const RECALIBRATED_CITIZENS: Record<string, RecalibratedInfo> = {
  "usr_c50f29a5": {
    inGameName: "Spinning_Hexagon",
    units: 100,
    grossPaid: 550.00,
    taxDeducted: 27.50,
    netReceived: 522.50,
    initialCredited: 500.00,
    adjustmentCredit: 22.50,
  },
  "usr_8e9f8fdf": {
    inGameName: "Avemon",
    units: 50,
    grossPaid: 275.00,
    taxDeducted: 13.75,
    netReceived: 261.25,
    initialCredited: 250.00,
    adjustmentCredit: 11.25,
  },
  "usr_ed4c52bb": {
    inGameName: "Bug",
    units: 30,
    grossPaid: 165.00,
    taxDeducted: 8.25,
    netReceived: 156.75,
    initialCredited: 150.00,
    adjustmentCredit: 6.75,
  },
  "usr_b41a9a95": {
    inGameName: "LilyXRose",
    units: 8,
    grossPaid: 44.00,
    taxDeducted: 2.20,
    netReceived: 41.80,
    initialCredited: 35.00,
    adjustmentCredit: 6.80,
  },
  "usr_467a4aa3": {
    inGameName: "Bishop_Richiee",
    units: 10,
    grossPaid: 55.00,
    taxDeducted: 2.75,
    netReceived: 52.25,
    initialCredited: 50.00,
    adjustmentCredit: 2.25,
  },
  "usr_1ce6c427": {
    inGameName: "Sus_Destro",
    units: 2,
    grossPaid: 11.00,
    taxDeducted: 0.55,
    netReceived: 10.45,
    initialCredited: 10.00,
    adjustmentCredit: 0.45,
  },
};
