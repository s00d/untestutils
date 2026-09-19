<template>
  <div>
    <nav data-mark="nav">
      <NuxtLink to="/" data-nav="home">Home</NuxtLink>
      <NuxtLink to="/about" data-nav="about">About</NuxtLink>
      <NuxtLink to="/search" data-nav="search">Search</NuxtLink>
      <NuxtLink to="/session" data-nav="session">Session</NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>
