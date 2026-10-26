from django.contrib import admin
from django.contrib.auth import views as auth
from django.urls import path
from fees import views
urlpatterns = [path('collections/',views.collections),path('admin/',admin.site.urls),path('login/',auth.LoginView.as_view(template_name='fees/login.html')),path('logout/',auth.LogoutView.as_view()),path('',views.dashboard,name='dashboard'),path('students/new/',views.student_new),path('students/<int:pk>/',views.student_detail,name='student'),path('import/',views.import_workbook),path('export/',views.export),path('receipts/<int:pk>/',views.receipt)]
