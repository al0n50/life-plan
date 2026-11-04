// Optional career ladder templates. A user can start a career track from one of these.
// Salary ranges are rough U.S. estimates for planning only.

export interface CareerRung {
  title: string;
  salaryLow: number;
  salaryHigh: number;
  /** Typical years spent in this rung before moving up. */
  typicalYears: number;
  /** What to work on while in this rung to reach the next one. */
  focus: string[];
}

export interface CareerField {
  id: string;
  name: string;
  ladder: CareerRung[];
}

export const CAREER_FIELDS: CareerField[] = [
  {
    id: 'software',
    name: 'Software & IT',
    ladder: [
      { title: 'IT Support / Help Desk', salaryLow: 42000, salaryHigh: 58000, typicalYears: 1.5, focus: ['Earn CompTIA A+ or Network+', 'Learn scripting (Python or PowerShell)', 'Build a home lab and document it'] },
      { title: 'Junior Developer', salaryLow: 65000, salaryHigh: 90000, typicalYears: 2, focus: ['Ship features end to end', 'Learn testing and code review', 'Build 2 portfolio projects'] },
      { title: 'Software Engineer', salaryLow: 95000, salaryHigh: 135000, typicalYears: 3, focus: ['Own a system or service', 'Learn system design', 'Mentor a junior developer'] },
      { title: 'Senior Software Engineer', salaryLow: 135000, salaryHigh: 185000, typicalYears: 3, focus: ['Lead cross-team projects', 'Write design docs', 'Build visibility with leadership'] },
      { title: 'Staff Engineer / Eng Manager', salaryLow: 180000, salaryHigh: 250000, typicalYears: 4, focus: ['Set technical direction', 'Grow other leaders'] },
    ],
  },
  {
    id: 'nursing',
    name: 'Nursing & Healthcare',
    ladder: [
      { title: 'CNA / Patient Care Tech', salaryLow: 32000, salaryHigh: 42000, typicalYears: 1.5, focus: ['Apply to an LPN or ADN program', 'Complete prerequisites (A&P, Micro)', 'Ask about tuition reimbursement'] },
      { title: 'LPN', salaryLow: 50000, salaryHigh: 62000, typicalYears: 2, focus: ['Enroll in an LPN-to-RN bridge', 'Build IV and med-pass skills'] },
      { title: 'Registered Nurse (ADN)', salaryLow: 72000, salaryHigh: 92000, typicalYears: 2, focus: ['Start an RN-to-BSN program', 'Pick a specialty and get certified'] },
      { title: 'RN, BSN + Specialty', salaryLow: 85000, salaryHigh: 110000, typicalYears: 3, focus: ['Charge nurse experience', 'Research NP or CRNA programs'] },
      { title: 'Nurse Practitioner', salaryLow: 115000, salaryHigh: 145000, typicalYears: 4, focus: ['Board certification upkeep', 'Consider practice leadership'] },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting & Finance',
    ladder: [
      { title: 'Accounting Clerk / AP-AR', salaryLow: 40000, salaryHigh: 52000, typicalYears: 1.5, focus: ['Finish accounting degree credits', 'Master Excel (pivots, lookups)'] },
      { title: 'Staff Accountant', salaryLow: 58000, salaryHigh: 75000, typicalYears: 2, focus: ['Study for the CPA exam', 'Own month-end close tasks'] },
      { title: 'Senior Accountant', salaryLow: 75000, salaryHigh: 98000, typicalYears: 2.5, focus: ['Pass remaining CPA sections', 'Lead an audit or close process'] },
      { title: 'Accounting Manager', salaryLow: 95000, salaryHigh: 125000, typicalYears: 3, focus: ['Manage a team', 'Learn FP&A and forecasting'] },
      { title: 'Controller', salaryLow: 125000, salaryHigh: 175000, typicalYears: 4, focus: ['Partner with the CFO', 'Own company-wide reporting'] },
    ],
  },
  {
    id: 'trades',
    name: 'Skilled Trades',
    ladder: [
      { title: 'Apprentice', salaryLow: 35000, salaryHigh: 48000, typicalYears: 4, focus: ['Log apprenticeship hours', 'Classroom hours and code study', 'Get OSHA 10/30'] },
      { title: 'Journeyman', salaryLow: 58000, salaryHigh: 80000, typicalYears: 3, focus: ['Prepare for the master license exam', 'Learn estimating and bidding'] },
      { title: 'Master / Foreman', salaryLow: 78000, salaryHigh: 105000, typicalYears: 3, focus: ['Run crews and jobs', 'Get a contractor license'] },
      { title: 'Contractor / Business Owner', salaryLow: 95000, salaryHigh: 160000, typicalYears: 5, focus: ['Grow repeat clients', 'Hire and train'] },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    ladder: [
      { title: 'Sales Development Rep', salaryLow: 45000, salaryHigh: 65000, typicalYears: 1.5, focus: ['Beat quota 3 quarters in a row', 'Learn discovery calls'] },
      { title: 'Account Executive', salaryLow: 70000, salaryHigh: 120000, typicalYears: 2.5, focus: ['Close larger deals', 'Build a referral network'] },
      { title: 'Senior / Enterprise AE', salaryLow: 120000, salaryHigh: 200000, typicalYears: 3, focus: ['Run complex multi-stakeholder deals', 'Coach newer reps'] },
      { title: 'Sales Manager', salaryLow: 140000, salaryHigh: 220000, typicalYears: 4, focus: ['Hire, forecast, and coach a team'] },
    ],
  },
  {
    id: 'education',
    name: 'Education',
    ladder: [
      { title: 'Paraprofessional / Aide', salaryLow: 25000, salaryHigh: 35000, typicalYears: 2, focus: ['Finish a bachelor’s degree', 'Look into alternative certification'] },
      { title: 'Teacher', salaryLow: 45000, salaryHigh: 62000, typicalYears: 4, focus: ['Earn a master’s for the pay-scale bump', 'Take on department roles'] },
      { title: 'Teacher, Master’s + Lead', salaryLow: 60000, salaryHigh: 80000, typicalYears: 4, focus: ['Get admin certification', 'Lead school-wide initiatives'] },
      { title: 'Assistant Principal', salaryLow: 80000, salaryHigh: 105000, typicalYears: 3, focus: ['Manage staff and operations'] },
      { title: 'Principal', salaryLow: 100000, salaryHigh: 135000, typicalYears: 5, focus: ['Lead the whole school'] },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Creative',
    ladder: [
      { title: 'Marketing Coordinator', salaryLow: 42000, salaryHigh: 55000, typicalYears: 2, focus: ['Get Google Analytics / Ads certified', 'Build a portfolio of campaigns'] },
      { title: 'Marketing Specialist', salaryLow: 55000, salaryHigh: 75000, typicalYears: 2, focus: ['Own a channel and its results', 'Learn budgeting and attribution'] },
      { title: 'Marketing Manager', salaryLow: 80000, salaryHigh: 115000, typicalYears: 3, focus: ['Manage people and agencies', 'Present results to leadership'] },
      { title: 'Director of Marketing', salaryLow: 120000, salaryHigh: 170000, typicalYears: 4, focus: ['Own strategy and revenue targets'] },
    ],
  },
  {
    id: 'general',
    name: 'Other / General',
    ladder: [
      { title: 'Entry Level', salaryLow: 32000, salaryHigh: 45000, typicalYears: 1.5, focus: ['Learn the core skills of your role', 'Find a mentor', 'Track your wins weekly'] },
      { title: 'Experienced', salaryLow: 45000, salaryHigh: 65000, typicalYears: 2, focus: ['Earn a certification in your field', 'Take on a stretch project'] },
      { title: 'Senior', salaryLow: 65000, salaryHigh: 90000, typicalYears: 3, focus: ['Train others', 'Own outcomes, not just tasks'] },
      { title: 'Lead / Supervisor', salaryLow: 80000, salaryHigh: 110000, typicalYears: 3, focus: ['Manage people and schedules', 'Learn budgeting'] },
      { title: 'Manager', salaryLow: 95000, salaryHigh: 140000, typicalYears: 4, focus: ['Set direction for a team'] },
    ],
  },
];

export function getField(id: string | undefined): CareerField | undefined {
  return CAREER_FIELDS.find((f) => f.id === id);
}

export const rungMid = (r: CareerRung) => (r.salaryLow + r.salaryHigh) / 2;
