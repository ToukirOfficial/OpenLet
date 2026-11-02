import { redirect } from 'next/navigation';

// The landing page arrives in the last phase (plan.md, Phase 10).
export default function Home() {
  redirect('/login');
}
