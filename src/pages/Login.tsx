import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // Changed error state to an object to track field-specific errors
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error for the specific field when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined, form: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    let isValid = true;

    // Email Validation
    if (!formData.email.trim()) {
      newErrors.email = "This field is mandatory.";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address."; // Specific requirement
      isValid = false;
    }

    // Password Validation
    if (!formData.password) {
      newErrors.password = "This field is mandatory.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({}); // Clear previous errors

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        // Specific requirement: 401/Auth error -> "Incorrect email or password."
        if (error.status === 400 || error.message.includes("Invalid login credentials")) { // Supabase often returns "Invalid login credentials" for 400
             throw new Error("Incorrect email or password.");
        }
        throw error;
      }
      
      navigate('/dashboard');
    } catch (err: any) {
      // If it's the specific auth error we just threw, set it on the form or password field? 
      // Requirement says: "Login - Password: ... Error: 'Incorrect email or password.'"
      // So we attach it to the password field or a general area? 
      // "If a field is invalid, display... directly below the input field." 
      // The error "Incorrect email or password" applies to the combination, but usually displayed near password or top.
      // Let's display it near password or general form error. 
      // Requirement: "Login - Password: If the backend returns a 401... Error: 'Incorrect email or password.'"
      // So I will set it on the password field to be safe.
      setErrors({ password: err.message });
      // Or maybe strictly form error? User said "Login - Password: ... Error: ...". 
      // I'll stick to password field for now, as it's more specific.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">
          Sign in to your account
        </h3>
        
        {/* General Form Error (fallback) */}
        {errors.form && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {errors.form}
            </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="text" // generic text to avoid browser default email validation popup if we want custom UI
                autoComplete="off" // Requirement
                // required // Requirement removed
                value={formData.email}
                onChange={handleChange}
                className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`} // Requirement: Red border
              />
              {/* Requirement: Error message below input */}
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="off" // Requirement
                // required // Requirement removed
                value={formData.password}
                onChange={handleChange}
                className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`} // Requirement: Red border
              />
               {/* Requirement: Error message below input */}
               {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Don't have an account?
              </span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
