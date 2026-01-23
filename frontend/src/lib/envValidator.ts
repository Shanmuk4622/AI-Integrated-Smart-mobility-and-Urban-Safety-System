/**
 * Environment variable validation for frontend.
 * Ensures required Supabase configuration is present.
 */

interface EnvValidationResult {
    isValid: boolean;
    errors: string[];
}

export class EnvValidator {
    private static readonly REQUIRED_VARS = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY'
    ];

    /**
     * Validate all required environment variables.
     */
    static validate(): EnvValidationResult {
        const errors: string[] = [];

        // Check each required variable
        this.REQUIRED_VARS.forEach(varName => {
            const value = import.meta.env[varName];

            if (!value || value.trim() === '') {
                errors.push(`Missing required environment variable: ${varName}`);
            }
        });

        // Validate Supabase URL format
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
            errors.push('VITE_SUPABASE_URL must start with "https://"');
        }

        // Validate Supabase URL ends with .supabase.co
        if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
            errors.push('VITE_SUPABASE_URL must be a valid Supabase URL (*.supabase.co)');
        }

        // Validate anon key format (should be a JWT)
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (anonKey && !anonKey.startsWith('eyJ')) {
            errors.push('VITE_SUPABASE_ANON_KEY appears to be invalid (should be a JWT token)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate and throw error if validation fails.
     * Call this on app startup.
     */
    static validateOrThrow(): void {
        const result = this.validate();

        if (!result.isValid) {
            const errorMessage = [
                '❌ Environment Configuration Error:',
                ...result.errors.map(err => `  - ${err}`),
                '',
                'Please check your .env file and ensure all required variables are set.',
                'See VERCEL_ENV_SETUP.md for details.'
            ].join('\n');

            console.error(errorMessage);
            throw new Error('Environment validation failed. Check console for details.');
        }

        console.log('✅ Environment validation passed');
    }

    /**
     * Get environment info for debugging (safe - doesn't expose secrets).
     */
    static getEnvInfo(): Record<string, string> {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

        return {
            supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
            anonKeyPresent: anonKey ? 'YES' : 'NO',
            mode: import.meta.env.MODE,
            dev: import.meta.env.DEV ? 'true' : 'false'
        };
    }
}

/**
 * Validate environment on module load (development only).
 */
if (import.meta.env.DEV) {
    try {
        EnvValidator.validateOrThrow();
    } catch (error) {
        // Error already logged, just prevent app from starting
    }
}
