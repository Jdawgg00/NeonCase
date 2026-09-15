export default defineNuxtRouteMiddleware(() => {
  const { data: session, status } = useAuth()
  if (status.value !== 'authenticated') return navigateTo('/login')
  if (session.value?.user?.role !== 'ADMIN') return navigateTo('/dashboard')
})
