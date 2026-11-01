import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Home,
  Zap,
  Wind,
  Sun,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import {
  HouseholdProfile,
  GUJARAT_DISTRICTS,
  APPLIANCE_CATALOG,
  calculateSustainabilityMetrics,
} from '../utils/sustainabilityMath';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: HouseholdProfile;
  onSaveProfile: (profile: HouseholdProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSaveProfile,
}) => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<HouseholdProfile>({
    ...currentProfile,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Real-time calculation of baseline metrics
  const previewMetrics = calculateSustainabilityMetrics(formData);

  const validateStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {};
    if (currentStep === 1) {
      if (!formData.name.trim()) errs.name = 'Please enter your name';
      if (!formData.city.trim()) errs.city = 'Please enter your city / town';
      if (!formData.district) errs.district = 'Please select your Gujarat district';
      if (!formData.familyMembers || formData.familyMembers < 1) {
        errs.familyMembers = 'Family members must be at least 1';
      }
    } else if (currentStep === 2) {
      if (!formData.monthlyKwh || formData.monthlyKwh < 10) {
        errs.monthlyKwh = 'Please enter a valid monthly consumption (min 10 kWh)';
      }
      if (!formData.monthlyBillInr || formData.monthlyBillInr < 50) {
        errs.monthlyBillInr = 'Please enter an estimated bill amount in ₹';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const toggleAppliance = (appId: string) => {
    const current = [...(formData.appliances || [])];
    const index = current.indexOf(appId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(appId);
    }
    setFormData({ ...formData, appliances: current });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(step)) {
      onSaveProfile(formData);
      onClose();
    }
  };

  // Quick helper to autofill estimated bill from kWh assuming average Gujarat tariff
  const handleKwhChange = (kwh: number) => {
    const estBill = Math.round(kwh * 6.2);
    setFormData((prev) => ({
      ...prev,
      monthlyKwh: kwh,
      monthlyBillInr: prev.monthlyBillInr > 0 ? prev.monthlyBillInr : estBill,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-lime-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading flex items-center gap-2">
                Household Sustainability Baseline Assessment
              </h2>
              <p className="text-xs text-emerald-200">
                GEDA Mission LiFE • Gujarat Residential Energy Companion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-step progress bar */}
        <div className="bg-emerald-50/70 px-6 py-3 border-b border-emerald-100 flex items-center justify-between">
          {[
            { num: 1, title: 'Household' },
            { num: 2, title: 'Electricity' },
            { num: 3, title: 'Appliances' },
            { num: 4, title: 'Rooftop & Baseline' },
          ].map((item) => (
            <div key={item.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === item.num
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                    : step > item.num
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > item.num ? '✓' : item.num}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  step === item.num ? 'font-bold text-emerald-900' : 'text-gray-500'
                }`}
              >
                {item.title}
              </span>
              {item.num < 4 && <div className="w-6 sm:w-10 h-0.5 bg-gray-200 ml-1" />}
            </div>
          ))}
        </div>

        {/* Step Forms */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* STEP 1: Basic Household Details */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Home className="w-4 h-4 text-emerald-600" />
                  Step 1: Household Profile in Gujarat
                </h3>
                <p className="text-xs text-gray-500">
                  Enter your family details to calibrate per-capita energy benchmarks.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name / Household Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel / Patel Residence"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    City / Town / Village *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Gandhinagar, Surat, Maninagar"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                  {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    District in Gujarat *
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white"
                  >
                    <option value="">Select Gujarat District</option>
                    {GUJARAT_DISTRICTS.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                  {errors.district && (
                    <p className="text-xs text-red-500 mt-1">{errors.district}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Number of Family Members Living in Household:
                  <span className="text-emerald-700 font-bold ml-1">
                    {formData.familyMembers} Persons
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={formData.familyMembers}
                    onChange={(e) =>
                      setFormData({ ...formData, familyMembers: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full accent-emerald-600"
                  />
                  <div className="w-12 text-center py-1.5 px-2 bg-emerald-50 text-emerald-800 font-bold rounded-md border border-emerald-200 text-sm">
                    {formData.familyMembers}
                  </div>
                </div>
                {errors.familyMembers && (
                  <p className="text-xs text-red-500 mt-1">{errors.familyMembers}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Electricity Consumption & Bill */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Step 2: Electricity Consumption & Billing
                </h3>
                <p className="text-xs text-gray-500">
                  Refer to your recent DISCOM power bill (UGVCL, PGVCL, DGVCL, MGVCL, or Torrent Power).
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Monthly Electricity Consumption (Units in kWh) *
                  </label>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    ~{Math.round(formData.monthlyKwh / (formData.familyMembers || 1))} kWh / person
                  </span>
                </div>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={formData.monthlyKwh || ''}
                  onChange={(e) => handleKwhChange(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 300"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold"
                />
                {errors.monthlyKwh && (
                  <p className="text-xs text-red-500 mt-1">{errors.monthlyKwh}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-500">Quick select:</span>
                  {[150, 250, 350, 500].map((kwh) => (
                    <button
                      type="button"
                      key={kwh}
                      onClick={() => handleKwhChange(kwh)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        formData.monthlyKwh === kwh
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {kwh} kWh
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Average Monthly Electricity Bill (in ₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm font-medium">₹</span>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={formData.monthlyBillInr || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyBillInr: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="e.g. 1850"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold"
                  />
                </div>
                {errors.monthlyBillInr && (
                  <p className="text-xs text-red-500 mt-1">{errors.monthlyBillInr}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  Effective electricity rate:{' '}
                  <strong className="text-emerald-700">
                    ₹
                    {formData.monthlyKwh > 0
                      ? (formData.monthlyBillInr / formData.monthlyKwh).toFixed(2)
                      : '6.20'}
                    /kWh
                  </strong>{' '}
                  (Gujarat average residential slab: ~₹5.80 - ₹6.80)
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Major Household Appliances */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Wind className="w-4 h-4 text-emerald-600" />
                  Step 3: Major Household Electric Appliances
                </h3>
                <p className="text-xs text-gray-500">
                  Select appliances currently used in your home to pinpoint high-load savings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {APPLIANCE_CATALOG.map((appliance) => {
                  const isSelected = (formData.appliances || []).includes(appliance.id);
                  return (
                    <div
                      key={appliance.id}
                      onClick={() => toggleAppliance(appliance.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center text-white text-xs ${
                          isSelected ? 'bg-emerald-600' : 'border border-gray-300'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-900 truncate">
                            {appliance.name}
                          </h4>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              appliance.tag === 'High Load'
                                ? 'bg-amber-100 text-amber-800'
                                : appliance.tag === 'Constant'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {appliance.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          ~{appliance.avgKwh} kWh/month typical draw
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Rooftop Space & Baseline Calculation Review */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Sun className="w-4 h-4 text-emerald-600" />
                  Step 4: Rooftop Solar Status & Baseline Preview
                </h3>
                <p className="text-xs text-gray-500">
                  Assess terrace solar feasibility and review your Mission LiFE baseline.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Available Shadow-Free Rooftop Area (in Sq. Ft.)
                  </label>
                  <span className="text-xs font-bold text-emerald-700">
                    {formData.rooftopAvailableSqFt} sq. ft
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={formData.rooftopAvailableSqFt}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rooftopAvailableSqFt: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>0 (No roof access)</span>
                  <span>300 (Standard row house)</span>
                  <span>600+ (Independent bungalow)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="hasSolar"
                  checked={formData.hasSolarInstalled || false}
                  onChange={(e) =>
                    setFormData({ ...formData, hasSolarInstalled: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="hasSolar" className="text-xs font-medium text-gray-700">
                  I already have a grid-connected Rooftop Solar PV system installed
                </label>
              </div>

              {/* Live Baseline Preview Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-900 to-teal-900 text-white shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-emerald-700/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-lime-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
                      Calculated Baseline
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-emerald-700 rounded-full font-bold">
                    {previewMetrics.tier.titleGujarati} ({previewMetrics.tier.name.split(' ')[0]})
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-200">Green Score</p>
                    <p className="text-xl font-bold font-heading text-lime-300">
                      {previewMetrics.greenScore}
                      <span className="text-xs text-white/70">/100</span>
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-200">Monthly CO2</p>
                    <p className="text-base font-bold font-heading text-white">
                      {previewMetrics.monthlyCarbonKg}{' '}
                      <span className="text-[10px] text-emerald-300">kg</span>
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-200">Potential Savings</p>
                    <p className="text-base font-bold font-heading text-lime-300">
                      ₹{previewMetrics.potentialMonthlySavingInr}
                      <span className="text-[10px] text-white/70">/mo</span>
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-200/90 mt-3 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-lime-300 shrink-0" />
                  Mission LiFE recommendations can save you ~
                  <strong className="text-white">{previewMetrics.potentialMonthlySavingKwh} kWh</strong>{' '}
                  monthly in {formData.district || 'Gujarat'}.
                </p>
              </div>
            </div>
          )}

          {/* Action Navigation Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-lime-300" /> Save & Launch Dashboard
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
