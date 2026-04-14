import { Redirect } from 'expo-router';

/**
 * Halaman ini dinonaktifkan karena fitur pembuatan postingan 
 * sekarang sudah dipindahkan ke mode Popup (Modal) di TabLayout.
 */
export default function CreateScreen() {
  return <Redirect href="/" />;
}
