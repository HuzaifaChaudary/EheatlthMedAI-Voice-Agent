import { z } from 'zod';

export const patientIntakeSchema = z.object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Valid phone number is required'),
    dob: z.string().refine((date) => new Date(date) < new Date(), {
        message: 'Date of birth must be in the past',
    }),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
    address: z.string().min(5, 'Address is required'),
    emergencyContact: z.object({
        name: z.string().min(2, 'Contact name is required'),
        phone: z.string().min(10, 'Valid phone number is required'),
        relationship: z.string().min(2, 'Relationship is required'),
    }),
    medicalHistory: z.string().optional(),
    consent: z.boolean().refine(val => val === true, {
        message: 'You must consent to treatment',
    }),
});

export type PatientIntakeFormData = z.infer<typeof patientIntakeSchema>;

export const organizationSettingsSchema = z.object({
    name: z.string().min(2, 'Organization name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    address: z.string().optional(),
    website: z.string().url('Invalid URL').optional().or(z.literal('')),
});
