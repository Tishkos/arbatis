import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to login for security - middleware will handle authenticated redirects
  redirect('/ku/login');
}
