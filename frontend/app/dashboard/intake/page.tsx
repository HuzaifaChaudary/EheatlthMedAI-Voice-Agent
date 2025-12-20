"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientIntakeSchema, PatientIntakeFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { useSocket } from '@/components/providers/SocketProvider';
import { uploadFile } from '@/lib/api';

export default function PatientIntakePage() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<PatientIntakeFormData>({
        resolver: zodResolver(patientIntakeSchema),
    });

    const [uploadSuccess, setUploadSuccess] = useState(false);
    const { socket } = useSocket();

    const handleUpload = async (file: File) => {
        try {
            const response = await uploadFile('/uploads', file);
            if (response.error) {
                throw new Error(response.error);
            }
            console.log('File uploaded:', response.data);
            setUploadSuccess(true);
        } catch (error: any) {
            console.error('Upload error:', error);
            alert(`Failed to upload file: ${error.message}`);
        }
    };

    const onSubmit = async (data: PatientIntakeFormData) => {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('Form submitted:', data);

            // Emit event if socket connected
            if (socket) {
                socket.emit('patient:intake_submitted', {
                    name: `${data.firstName} ${data.lastName}`,
                    timestamp: new Date()
                });
            }

            alert('Patient intake form submitted successfully!');
            reset();
            setUploadSuccess(false);
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit form.');
        }
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl">Patient Intake Form</CardTitle>
                    <CardDescription>Please fill out the patient details and medical history.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="First Name"
                                {...register('firstName')}
                                error={errors.firstName?.message}
                                placeholder="John"
                            />
                            <Input
                                label="Last Name"
                                {...register('lastName')}
                                error={errors.lastName?.message}
                                placeholder="Doe"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Email"
                                type="email"
                                {...register('email')}
                                error={errors.email?.message}
                                placeholder="john.doe@example.com"
                            />
                            <Input
                                label="Phone Number"
                                type="tel"
                                {...register('phone')}
                                error={errors.phone?.message}
                                placeholder="(555) 123-4567"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Date of Birth"
                                type="date"
                                {...register('dob')}
                                error={errors.dob?.message}
                            />
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Gender</label>
                                <select
                                    {...register('gender')}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                                {errors.gender && <p className="text-xs font-medium text-destructive">{errors.gender.message}</p>}
                            </div>
                        </div>

                        <Input
                            label="Address"
                            {...register('address')}
                            error={errors.address?.message}
                            placeholder="123 Main St, City, State"
                        />

                        <div className="border-t pt-4">
                            <h3 className="text-lg font-medium mb-4">Emergency Contact</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input
                                    label="Name"
                                    {...register('emergencyContact.name')}
                                    error={errors.emergencyContact?.name?.message}
                                />
                                <Input
                                    label="Phone"
                                    {...register('emergencyContact.phone')}
                                    error={errors.emergencyContact?.phone?.message}
                                />
                                <Input
                                    label="Relationship"
                                    {...register('emergencyContact.relationship')}
                                    error={errors.emergencyContact?.relationship?.message}
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Medical Records / ID Upload</label>
                                <FileUpload onUpload={handleUpload} accept=".pdf,.jpg,.png" />
                                {uploadSuccess && <p className="text-sm text-green-600">Document attached.</p>}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-4">
                            <input
                                type="checkbox"
                                id="consent"
                                {...register('consent')}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="consent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                I consent to the processing of my personal health information.
                            </label>
                        </div>
                        {errors.consent && <p className="text-xs font-medium text-destructive">{errors.consent.message}</p>}

                        <div className="flex justify-end pt-6">
                            <Button type="submit" loading={isSubmitting} size="lg">
                                Submit Intake Form
                            </Button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
