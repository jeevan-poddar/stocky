import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import SuccessModal from '../components/SuccessModal';

const SignUp = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<{isOpen: boolean, title: string, message: string}>({
      isOpen: false,
      title: '',
      message: ''
  });
  // Errors object state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    shopName: '',
    ownerName: '',
    phone: '',
    city: '',
    state: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
     // Clear error for the specific field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
      const newErrors: { [key: string]: string } = {};
      let isValid = true;

      if (!formData.email.trim()) {
          newErrors.email = "This field is mandatory.";
          isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Please enter a valid email address."; 
          isValid = false;
      }

      if (!formData.password) {
          newErrors.password = "This field is mandatory.";
          isValid = false;
      } else if (formData.password.length < 6) {
           newErrors.password = "Password must be at least 6 characters.";
           isValid = false;
      }

      if (!formData.shopName.trim()) { newErrors.shopName = "This field is mandatory."; isValid = false; }
      if (!formData.ownerName.trim()) { newErrors.ownerName = "This field is mandatory."; isValid = false; }
      if (!formData.phone.trim()) { newErrors.phone = "This field is mandatory."; isValid = false; }
      if (!formData.city.trim()) { newErrors.city = "This field is mandatory."; isValid = false; }
      if (!formData.state.trim()) { newErrors.state = "This field is mandatory."; isValid = false; }

      setErrors(newErrors);
      return isValid;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    setGlobalError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            shop_name: formData.shopName,
            owner_name: formData.ownerName,
            phone: formData.phone,
            city: formData.city,
            state: formData.state,
          },
        },
      });

      if (error) throw error;
      
      // Show success modal
      setSuccessModal({
        isOpen: true,
        title: 'Sign Up Successful!',
        message: 'Please check your email to confirm your account.'
      });
      // Delay navigation so user can see the modal
      setTimeout(() => {
          navigate('/login');
      }, 3000);

    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">
          Create Strategy Account
        </h3>
        {globalError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {globalError}
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
                type="text"
                autoComplete="off"
                // required
                value={formData.email}
                onChange={handleChange}
                 className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
              />
               {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
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
                autoComplete="off"
                // required
                value={formData.password}
                onChange={handleChange}
                className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
             <div>
              <label htmlFor="shopName" className="block text-sm font-medium text-gray-700">
                Shop Name
              </label>
              <div className="mt-1">
                <input
                  id="shopName"
                  name="shopName"
                  type="text"
                  autoComplete="off"
                  // required
                  value={formData.shopName}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.shopName ? 'border-red-500' : 'border-gray-300'
                }`}
                />
                 {errors.shopName && <p className="mt-1 text-xs text-red-600">{errors.shopName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700">
                Owner Name
              </label>
              <div className="mt-1">
                <input
                  id="ownerName"
                  name="ownerName"
                  type="text"
                  autoComplete="off"
                  // required
                  value={formData.ownerName}
                  onChange={handleChange}
                   className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.ownerName ? 'border-red-500' : 'border-gray-300'
                }`}
                />
                 {errors.ownerName && <p className="mt-1 text-xs text-red-600">{errors.ownerName}</p>}
              </div>
            </div>
          </div>
          
           <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <div className="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="text" // Changed to text for consistent validation control
                  autoComplete="off"
                  // required
                  value={formData.phone}
                  onChange={handleChange}
                   className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                />
                 {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
            </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <div className="mt-1">
                <input
                  id="city"
                  name="city"
                  type="text"
                  autoComplete="off"
                  // required
                  value={formData.city}
                  onChange={handleChange}
                   className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                />
                 {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                State
              </label>
              <div className="mt-1">
                <input
                  id="state"
                  name="state"
                  type="text"
                  autoComplete="off"
                  // required
                  value={formData.state}
                  onChange={handleChange}
                   className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.state ? 'border-red-500' : 'border-gray-300'
                }`}
                />
                 {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
              </div>
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
                  Creating account...
                </>
              ) : (
                'Sign up'
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
                Already have an account?
              </span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </div>
        </div>
      </div>
       <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal(prev => ({...prev, isOpen: false}))}
        title={successModal.title}
        message={successModal.message}
        autoClose={false} 
      />
    </div>
  );
};

export default SignUp;
