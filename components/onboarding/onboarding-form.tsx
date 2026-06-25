"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { OnboardingStepper } from "./onboarding-stepper";
import { StepBusinessInfo } from "./step-business-info";
import { StepContact } from "./step-contact";
import { StepAssistant } from "./step-assistant";
import { StepWidget } from "./step-widget";
import { StepSuccess } from "./step-success";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { completeOnboarding, OnboardingData } from "@/lib/actions/onboarding";

export function OnboardingForm({ initialData }: { initialData: Partial<OnboardingData> }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<OnboardingData>({
    mode: "onChange",
    defaultValues: {
      businessName: initialData.businessName || "",
      industry: initialData.industry || "",
      websiteUrl: initialData.websiteUrl || "",
      description: initialData.description || "",
      contactEmail: initialData.contactEmail || "",
      phone: initialData.phone || "",
      whatsapp: initialData.whatsapp || "",
      address: initialData.address || "",
      assistantName: initialData.assistantName || "",
      assistantTone: initialData.assistantTone || "Friendly",
      welcomeMessage: initialData.welcomeMessage || "Hello! I'm your AI assistant. How can I help you today?",
      primaryColor: initialData.primaryColor || "",
      position: (initialData.position as any) || "",
      suggestedQuestions: initialData.suggestedQuestions || ["How much does it cost?", "What are your hours?"]
    }
  });

  const stepFields: Record<number, (keyof OnboardingData)[]> = {
    1: ["businessName", "industry", "websiteUrl", "description"],
    2: ["contactEmail"],
    3: ["assistantName", "assistantTone", "welcomeMessage"],
    4: ["primaryColor", "position"],
  };

  const nextStep = async () => {
    const isValid = await trigger(stepFields[step]);
    if (isValid) setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => s - 1);

  const onSubmit = async (data: OnboardingData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await completeOnboarding(data);
      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else {
        setStep(5); // Success step
      }
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <StepBusinessInfo register={register} errors={errors} />;
      case 2: return <StepContact register={register} errors={errors} />;
      case 3: return <StepAssistant register={register} errors={errors} watch={watch} />;
      case 4: return <StepWidget register={register} watch={watch} setValue={setValue} errors={errors} />;
      case 5: return <StepSuccess />;
      default: return null;
    }
  };

  const stepTitles = [
    "Tell us about your business",
    "How can customers reach you?",
    "Configure your AI assistant",
    "Customize your widget",
    "All finished!"
  ];

  const stepDescriptions = [
    "This helps us train your AI and generate a personalized profile.",
    "These details will be used by the AI to answer visitor questions.",
    "Define how your AI should interact with your customers.",
    "Match the widget with your brand identity and set quick questions.",
    "Your business is ready to start capturing leads."
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {step < 5 && <OnboardingStepper currentStep={step} totalSteps={4} />}
      
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-indigo-100 overflow-hidden">
        <div className="p-10 md:p-14">
          {step < 5 && (
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{stepTitles[step-1]}</h2>
              <p className="text-slate-500">{stepDescriptions[step-1]}</p>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold">
              {error}
            </div>
          )}

          <form onSubmit={(e) => {
            e.preventDefault();
            if (step < 4) {
              nextStep();
            }
          }}>
            {renderStep()}

            {step < 5 && (
              <div className="mt-12 flex items-center justify-between gap-4">
                {step > 1 ? (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={prevStep}
                    className="h-14 px-8 rounded-2xl font-bold text-slate-500 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back
                  </Button>
                ) : <div />}

                {step < 4 ? (
                  <Button 
                    type="button" 
                    onClick={nextStep}
                    className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-lg shadow-indigo-100"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-lg shadow-indigo-100"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
